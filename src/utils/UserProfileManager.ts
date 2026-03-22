
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export interface UserProfile {
    name: string;
    age: string;
    gender: 'Male' | 'Female' | 'Other';
    weight: string; // kg
    height: string; // cm
    profileImage?: string; // base64
}

const DB_NAME = 'sahayak.db';

let db: SQLite.SQLiteDatabase | null = null;

export const initProfileDB = async () => {
    try {
        if (db) return db;
        
        db = await SQLite.openDatabase({
            name: DB_NAME,
            location: 'default',
        });

        await db.executeSql(
            `CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT,
                age TEXT,
                gender TEXT,
                weight TEXT,
                height TEXT,
                profileImage TEXT
            );`
        );
        
        console.log('Profile DB initialized');
        return db;
    } catch (error) {
        console.error('Error initializing DB:', error);
        throw error;
    }
};

export const loadUserProfile = async (): Promise<UserProfile | null> => {
    try {
        const database = await initProfileDB();
        const [results] = await database.executeSql('SELECT * FROM user_profile WHERE id = 1 LIMIT 1');
        
        if (results.rows.length > 0) {
            return results.rows.item(0) as UserProfile;
        }
        return null;
    } catch (error) {
        console.error('Error loading profile from SQLite:', error);
        return null;
    }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
    try {
        const database = await initProfileDB();
        await database.executeSql(
            `INSERT OR REPLACE INTO user_profile (id, name, age, gender, weight, height, profileImage)
             VALUES (1, ?, ?, ?, ?, ?, ?);`,
            [profile.name, profile.age, profile.gender, profile.weight, profile.height, profile.profileImage || null]
        );
        console.log('Profile saved to SQLite');
    } catch (error) {
        console.error('Error saving profile to SQLite:', error);
        throw error;
    }
};

export const calculateBMI = (weight: number, height: number): number => {
    if (height === 0) return 0;
    return weight / ((height / 100) * (height / 100));
};

export const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
};

export const buildProfileContext = (profile: UserProfile): string => {
    return `Patient name: ${profile.name}, Age: ${profile.age} years, Gender: ${profile.gender}, Weight: ${profile.weight} kg, Height: ${profile.height} cm`;
};