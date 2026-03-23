package ai.runanywhere.starter

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.*
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject

/**
 * SQLite helper for Sahayak AI chat storage.
 */
class ChatDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "sahayak_chat.db"
        const val DATABASE_VERSION = 1

        // Rooms table
        const val TABLE_ROOMS = "rooms"
        const val COL_ROOM_ID = "id"
        const val COL_ROOM_TITLE = "title"
        const val COL_ROOM_CONTEXT = "context"
        const val COL_ROOM_CREATED = "created_at"
        const val COL_ROOM_UPDATED = "updated_at"

        // Messages table
        const val TABLE_MESSAGES = "messages"
        const val COL_MSG_ID = "id"
        const val COL_MSG_ROOM_ID = "room_id"
        const val COL_MSG_TEXT = "text"
        const val COL_MSG_IS_USER = "is_user"
        const val COL_MSG_TIMESTAMP = "timestamp"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE $TABLE_ROOMS (
                $COL_ROOM_ID TEXT PRIMARY KEY,
                $COL_ROOM_TITLE TEXT NOT NULL,
                $COL_ROOM_CONTEXT TEXT DEFAULT '',
                $COL_ROOM_CREATED INTEGER NOT NULL,
                $COL_ROOM_UPDATED INTEGER NOT NULL
            )
        """)

        db.execSQL("""
            CREATE TABLE $TABLE_MESSAGES (
                $COL_MSG_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_MSG_ROOM_ID TEXT NOT NULL,
                $COL_MSG_TEXT TEXT NOT NULL,
                $COL_MSG_IS_USER INTEGER NOT NULL DEFAULT 0,
                $COL_MSG_TIMESTAMP INTEGER NOT NULL,
                FOREIGN KEY ($COL_MSG_ROOM_ID) REFERENCES $TABLE_ROOMS($COL_ROOM_ID) ON DELETE CASCADE
            )
        """)

        db.execSQL("CREATE INDEX idx_messages_room ON $TABLE_MESSAGES($COL_MSG_ROOM_ID)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_MESSAGES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ROOMS")
        onCreate(db)
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
    }
}

/**
 * ChatBackendModule — Kotlin native module for Sahayak AI
 *
 * Handles:
 * - Room CRUD (SQLite)
 * - Prompt building (pipeline selection: text vs OCR)
 * - Session history management (in-memory, separate from DB)
 *
 * The LLM call itself stays in JS (RunAnywhere SDK), but all business logic lives here.
 */
class ChatBackendModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ChatBackendModule"

    companion object {
        private const val MAX_SESSION_HISTORY = 6
    }

    private val dbHelper by lazy { ChatDatabaseHelper(reactApplicationContext) }

    // In-memory session history — NOT persisted, resets on app restart
    private val sessionHistory = mutableListOf<JSONObject>()

    // Persists last image OCR context so follow-up questions can reference it
    private var lastImageContext: String? = null

    // =========================================================================
    // Room CRUD
    // =========================================================================

    @ReactMethod
    fun createRoom(contextText: String, title: String?, promise: Promise) {
        try {
            val roomId = "room_${System.currentTimeMillis()}_${(Math.random() * 1000000).toLong()}"
            val now = System.currentTimeMillis()
            val roomTitle = if (title.isNullOrBlank()) "Scanned Document Chat" else title

            val db = dbHelper.writableDatabase

            // Insert room
            val roomValues = ContentValues().apply {
                put(ChatDatabaseHelper.COL_ROOM_ID, roomId)
                put(ChatDatabaseHelper.COL_ROOM_TITLE, roomTitle)
                put(ChatDatabaseHelper.COL_ROOM_CONTEXT, contextText)
                put(ChatDatabaseHelper.COL_ROOM_CREATED, now)
                put(ChatDatabaseHelper.COL_ROOM_UPDATED, now)
            }
            db.insert(ChatDatabaseHelper.TABLE_ROOMS, null, roomValues)

            promise.resolve(roomId)
        } catch (e: Exception) {
            promise.reject("CREATE_ROOM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getAllRooms(promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.query(
                ChatDatabaseHelper.TABLE_ROOMS, null, null, null,
                null, null, "${ChatDatabaseHelper.COL_ROOM_UPDATED} DESC"
            )

            val rooms = JSONArray()
            while (cursor.moveToNext()) {
                val room = JSONObject().apply {
                    put("id", cursor.getString(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_ROOM_ID)))
                    put("title", cursor.getString(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_ROOM_TITLE)))
                    put("context", cursor.getString(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_ROOM_CONTEXT)))
                    put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_ROOM_CREATED)))
                    put("lastUpdatedAt", cursor.getLong(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_ROOM_UPDATED)))
                }
                rooms.put(room)
            }
            cursor.close()

            promise.resolve(rooms.toString())
        } catch (e: Exception) {
            promise.reject("GET_ROOMS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getRoomHistory(roomId: String, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.query(
                ChatDatabaseHelper.TABLE_MESSAGES, null,
                "${ChatDatabaseHelper.COL_MSG_ROOM_ID} = ?", arrayOf(roomId),
                null, null, "${ChatDatabaseHelper.COL_MSG_TIMESTAMP} ASC"
            )

            val messages = JSONArray()
            while (cursor.moveToNext()) {
                val msg = JSONObject().apply {
                    put("text", cursor.getString(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_MSG_TEXT)))
                    put("isUser", cursor.getInt(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_MSG_IS_USER)) == 1)
                    put("timestamp", cursor.getLong(cursor.getColumnIndexOrThrow(ChatDatabaseHelper.COL_MSG_TIMESTAMP)))
                }
                messages.put(msg)
            }
            cursor.close()

            promise.resolve(messages.toString())
        } catch (e: Exception) {
            promise.reject("GET_HISTORY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun saveMessage(roomId: String, text: String, isUser: Boolean, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val now = System.currentTimeMillis()

            // Insert message
            val values = ContentValues().apply {
                put(ChatDatabaseHelper.COL_MSG_ROOM_ID, roomId)
                put(ChatDatabaseHelper.COL_MSG_TEXT, text)
                put(ChatDatabaseHelper.COL_MSG_IS_USER, if (isUser) 1 else 0)
                put(ChatDatabaseHelper.COL_MSG_TIMESTAMP, now)
            }
            db.insert(ChatDatabaseHelper.TABLE_MESSAGES, null, values)

            // Update room's lastUpdatedAt
            val updateValues = ContentValues().apply {
                put(ChatDatabaseHelper.COL_ROOM_UPDATED, now)
            }
            db.update(
                ChatDatabaseHelper.TABLE_ROOMS, updateValues,
                "${ChatDatabaseHelper.COL_ROOM_ID} = ?", arrayOf(roomId)
            )

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_MSG_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun deleteRoom(roomId: String, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            // Foreign key cascade will delete messages too
            db.delete(ChatDatabaseHelper.TABLE_ROOMS, "${ChatDatabaseHelper.COL_ROOM_ID} = ?", arrayOf(roomId))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DELETE_ROOM_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // Pipeline Prompt Builder
    // =========================================================================

    @ReactMethod
    fun buildPrompt(text: String, imageContext: String?, promise: Promise) {
        try {
            val hasOCR = !imageContext.isNullOrBlank()
            val userText = text.ifBlank {
                if (hasOCR) "Summarize the key information from this document." else ""
            }

            val result = JSONObject()

            if (hasOCR) {
                // ── OCR PIPELINE: Self-contained, no history ──
                // Store image context for follow-up questions
                lastImageContext = imageContext

                val prompt = "Reference Information:\n\"\"\"\n${imageContext}\n\"\"\"\n\n" +
                    "Question: $userText\n" +
                    "Answer the question using ONLY the reference information above. Be concise."

                val systemPrompt = "You are Dr. Sahayak, a professional medical doctor AI assistant.\n\n" +
                    "IMPORTANT RULES:\n" +
                    "• Always respond using bullet points (•)\n" +
                    "• Organize information clearly under appropriate items (e.g. Symptoms, Causes, Treatments)\n" +
                    "• Use a warm, professional, and caring tone\n" +
                    "• Include a disclaimer bullet advising real doctor consultation\n" +
                    "• Never definitively diagnose. Use soft phrasing like 'This could indicate...'\n" +
                    "• Answer based on the provided reference text. Summarize in your own words."

                result.put("prompt", prompt)
                result.put("systemPrompt", systemPrompt)
                result.put("maxTokens", 512)
                result.put("temperature", 0.3)

            } else if (!lastImageContext.isNullOrBlank()) {
                // ── TEXT + IMAGE FOLLOW-UP: User asking about a previously uploaded image ──
                addToSession(userText, true)

                val prompt = "Reference Information (from previously shared image):\n\"\"\"\n${lastImageContext}\n\"\"\"\n\n" +
                    "Previous conversation:\n" +
                    sessionHistory.takeLast(3).joinToString("\n") { msg ->
                        if (msg.getBoolean("isUser")) "User: ${msg.getString("text")}"
                        else "Assistant: ${msg.getString("text")}"
                    } + "\n\nAnswer the user's latest question using the reference information."

                val systemPrompt = "You are Dr. Sahayak, a professional medical doctor AI assistant.\n\n" +
                    "IMPORTANT RULES:\n" +
                    "• Always respond using bullet points (•)\n" +
                    "• Organize information clearly under appropriate items (e.g. Symptoms, Causes, Treatments)\n" +
                    "• Use a warm, professional, and caring tone\n" +
                    "• Include a disclaimer bullet advising real doctor consultation\n" +
                    "• Never definitively diagnose. Use soft phrasing like 'This could indicate...'\n" +
                    "• The user previously shared an image — use the reference information to answer their follow-up question."

                result.put("prompt", prompt)
                result.put("systemPrompt", systemPrompt)
                result.put("maxTokens", 512)
                result.put("temperature", 0.4)

            } else {
                // ── TEXT PIPELINE: Pure text, no image context ──
                addToSession(userText, true)

                val recentHistory = sessionHistory.takeLast(3)
                val prompt = StringBuilder()
                for (msg in recentHistory) {
                    if (msg.getBoolean("isUser")) {
                        prompt.append("User: ${msg.getString("text")}\n")
                    } else {
                        prompt.append("Assistant: ${msg.getString("text")}\n")
                    }
                }

                val systemPrompt = "You are Dr. Sahayak, a professional medical doctor AI assistant.\n\n" +
                    "IMPORTANT RULES:\n" +
                    "• Always respond using bullet points (•)\n" +
                    "• Organize information clearly under appropriate items (e.g. Symptoms, Causes, Treatments)\n" +
                    "• Use a warm, professional, and caring tone\n" +
                    "• Include a disclaimer bullet advising real doctor consultation\n" +
                    "• Never definitively diagnose. Use soft phrasing like 'This could indicate...'\n" +
                    "• Answer the user's question directly and concisely."

                result.put("prompt", prompt.toString().trimEnd())
                result.put("systemPrompt", systemPrompt)
                result.put("maxTokens", 256)
                result.put("temperature", 0.5)
            }

            // Stop sequences are no longer needed — the native layer handles EOS
            promise.resolve(result.toString())
        } catch (e: Exception) {
            promise.reject("BUILD_PROMPT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun trackAssistantResponse(text: String, promise: Promise) {
        try {
            addToSession(text, false)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TRACK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearSessionHistory(promise: Promise) {
        sessionHistory.clear()
        lastImageContext = null
        promise.resolve(true)
    }

    // =========================================================================
    // OCR Text Cleaning
    // =========================================================================

    @ReactMethod
    fun extractTextFromPdf(pdfUri: String, maxPages: Int, promise: Promise) {
        Thread {
            var renderer: PdfRenderer? = null
            var fileDescriptor: ParcelFileDescriptor? = null

            try {
                val uri = Uri.parse(pdfUri)
                fileDescriptor = reactApplicationContext.contentResolver.openFileDescriptor(uri, "r")
                    ?: throw IllegalArgumentException("Unable to open PDF URI")

                renderer = PdfRenderer(fileDescriptor)
                if (renderer.pageCount <= 0) {
                    promise.resolve("")
                    return@Thread
                }

                val pageLimit = if (maxPages > 0) maxPages else 3
                val pagesToProcess = minOf(pageLimit, renderer.pageCount)
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                val extracted = StringBuilder()

                for (pageIndex in 0 until pagesToProcess) {
                    val page = renderer.openPage(pageIndex)
                    val renderWidth = (page.width * 2).coerceAtLeast(page.width)
                    val renderHeight = (page.height * 2).coerceAtLeast(page.height)
                    val bitmap = Bitmap.createBitmap(renderWidth, renderHeight, Bitmap.Config.ARGB_8888)

                    try {
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        val inputImage = InputImage.fromBitmap(bitmap, 0)
                        val pageResult = Tasks.await(recognizer.process(inputImage))

                        if (!pageResult.text.isNullOrBlank()) {
                            if (extracted.isNotEmpty()) {
                                extracted.append("\n\n")
                            }
                            extracted.append("[Page ${pageIndex + 1}]\n")
                            extracted.append(pageResult.text)
                        }
                    } finally {
                        bitmap.recycle()
                        page.close()
                    }
                }

                recognizer.close()
                promise.resolve(extracted.toString())
            } catch (e: Exception) {
                promise.reject("PDF_OCR_ERROR", e.message, e)
            } finally {
                try {
                    renderer?.close()
                } catch (_: Exception) {
                }

                try {
                    fileDescriptor?.close()
                } catch (_: Exception) {
                }
            }
        }.start()
    }

    @ReactMethod
    fun cleanOCRText(rawText: String, promise: Promise) {
        try {
            val cleaned = rawText
                .replace(Regex("[^\\x20-\\x7E\\n\\r\\t]"), "")
                .replace(Regex("[ \\t]+"), " ")
                .replace(Regex("(\\n\\s*){3,}"), "\n\n")
                .lines().joinToString("\n") { it.trim() }
                .trim()
            promise.resolve(cleaned)
        } catch (e: Exception) {
            promise.resolve(rawText)
        }
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    private fun addToSession(text: String, isUser: Boolean) {
        val msg = JSONObject().apply {
            put("text", text)
            put("isUser", isUser)
            put("timestamp", System.currentTimeMillis())
        }
        sessionHistory.add(msg)
        while (sessionHistory.size > MAX_SESSION_HISTORY * 2) {
            sessionHistory.removeAt(0)
        }
    }
}
