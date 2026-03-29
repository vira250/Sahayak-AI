import React from 'react';
import { Text, StyleSheet, View, TextStyle } from 'react-native';

interface MarkdownRendererProps {
  text: string;
  baseStyle?: TextStyle;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  text, 
  baseStyle,
  isUser = false 
}) => {
  if (!text) return null;

  // Split text by lines to handle block-level formatting like headers and lists
  const lines = text.split('\n');
  
  return (
    <View style={styles.container}>
      {lines.map((line, lineIndex) => {
        // Handle Headers (### Title)
        if (line.startsWith('### ')) {
          return (
            <Text key={lineIndex} style={[styles.h3, isUser ? styles.userText : styles.assistantText]}>
              {renderInline(line.substring(4))}
            </Text>
          );
        }
        
        if (line.startsWith('## ')) {
          return (
            <Text key={lineIndex} style={[styles.h2, isUser ? styles.userText : styles.assistantText]}>
              {renderInline(line.substring(3))}
            </Text>
          );
        }

        if (line.startsWith('# ')) {
          return (
            <Text key={lineIndex} style={[styles.h1, isUser ? styles.userText : styles.assistantText]}>
              {renderInline(line.substring(2))}
            </Text>
          );
        }

        // Handle Bullet Points (• or -)
        if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
          const content = line.trim().substring(2);
          return (
            <View key={lineIndex} style={styles.listRow}>
              <Text style={[styles.bullet, isUser ? styles.userText : styles.assistantText]}>•</Text>
              <Text style={[styles.listItem, baseStyle, isUser ? styles.userText : styles.assistantText]}>
                {renderInline(content)}
              </Text>
            </View>
          );
        }

        // Default Paragraph
        return (
          <Text key={lineIndex} style={[styles.paragraph, baseStyle, isUser ? styles.userText : styles.assistantText]}>
            {renderInline(line)}
          </Text>
        );
      })}
    </View>
  );
};

// Helper to render inline formatting like **bold**
const renderInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={styles.bold}>
          {part.substring(2, part.length - 2)}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  h1: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  h2: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  h3: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  listRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 15,
    marginRight: 8,
    lineHeight: 22,
  },
  listItem: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '800',
  },
  userText: {
    color: '#000000',
  },
  assistantText: {
    color: '#1E293B',
  },
});
