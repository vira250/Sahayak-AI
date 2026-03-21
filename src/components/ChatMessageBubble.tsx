import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppColors } from '../theme';

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  tokensPerSecond?: number;
  totalTokens?: number;
  isError?: boolean;
  wasCancelled?: boolean;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onPlayTTS?: () => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  isStreaming = false,
  onPlayTTS,
}) => {
  const { text, isUser, tokensPerSecond, totalTokens, isError, wasCancelled } = message;

  // Render attachment styling if the text starts with the specific image context prefix
  const hasAttachment = text.startsWith('[Attached Image Context]\n');
  const displayText = hasAttachment ? text.replace('[Attached Image Context]\n', '') : text;

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isError && styles.errorBubble,
        ]}
      >
        {hasAttachment && isUser && (
          <View style={styles.attachmentWrapper}>
            <Text style={styles.attachmentIcon}>🖼️</Text>
            <Text style={styles.attachmentLabel}>Image Attached</Text>
          </View>
        )}
        <Text
          style={[
            styles.text,
            isUser ? styles.userText : styles.assistantText,
            isError && styles.errorText,
          ]}
        >
          {displayText}
        </Text>

        {!isUser && !isStreaming && (
          <View style={styles.metricsContainer}>
            {tokensPerSecond && (
              <Text style={styles.metrics}>
                ⚡ {tokensPerSecond.toFixed(1)} tok/s
              </Text>
            )}
            {totalTokens && (
              <Text style={styles.metrics}>📊 {totalTokens} tokens</Text>
            )}
            {onPlayTTS && (
              <TouchableOpacity onPress={onPlayTTS} style={styles.ttsButton} activeOpacity={0.6}>
                <Text style={styles.ttsIcon}>🔊</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {wasCancelled && (
          <Text style={styles.cancelledText}>⚠️ Generation cancelled</Text>
        )}

        {isStreaming && <Text style={styles.streamingIndicator}>▊</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 2,
  },
  userBubble: {
    backgroundColor: AppColors.navyMid,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: AppColors.surfaceCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorBubble: {
    backgroundColor: AppColors.error + '10',
    borderColor: AppColors.error + '30',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: AppColors.textPrimary,
  },
  errorText: {
    color: AppColors.error,
  },
  metricsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  metrics: {
    fontSize: 11,
    color: AppColors.textMuted,
  },
  cancelledText: {
    fontSize: 11,
    color: AppColors.warning,
    marginTop: 4,
  },
  streamingIndicator: {
    fontSize: 16,
    color: AppColors.navyMid,
    marginTop: 2,
  },
  attachmentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  attachmentIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  attachmentLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ttsButton: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
  },
  ttsIcon: {
    fontSize: 14,
  },
});
