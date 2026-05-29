import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Colors } from '../constants/theme';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

interface Props {
  iso: string;
  style?: TextStyle;
  prefix?: string;
}

export function TimeAgo({ iso, style, prefix = 'Updated ' }: Props) {
  return (
    <Text style={[{ fontSize: 12, color: Colors.textMuted }, style]}>
      {prefix}{timeAgo(iso)}
    </Text>
  );
}
