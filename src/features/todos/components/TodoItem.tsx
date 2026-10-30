import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { ThemedView } from '@/common/components/themed-view';
import type { Todo } from '../types/todo';
import { TaskButton } from './TaskButton';

interface TodoItemProps {
  todo: Todo;
  disabled: boolean;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const syncLabels = { pending: 'Saved on this device', failed: 'Waiting to retry sync', conflict: 'Needs conflict review', synced: 'Synced' };

export const TodoItem = memo(function TodoItem({ todo, disabled, onToggle, onEdit, onDelete }: TodoItemProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={todo.title}
        accessibilityState={{ checked: todo.completed, disabled }}
        disabled={disabled}
        onPress={() => onToggle(todo)}
        style={styles.task}>
        <ThemedText style={styles.checkbox}>{todo.completed ? '✓' : '○'}</ThemedText>
        <View style={styles.text}>
          <ThemedText style={todo.completed ? styles.completed : undefined}>{todo.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{syncLabels[todo.syncState]}</ThemedText>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <TaskButton label="Edit" accessibilityLabel={`Edit ${todo.title}`} disabled={disabled} onPress={() => onEdit(todo)} />
        <TaskButton label="Delete" accessibilityLabel={`Delete ${todo.title}`} disabled={disabled} onPress={() => onDelete(todo)} />
      </View>
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, gap: 8 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  checkbox: { fontSize: 26, width: 30, textAlign: 'center' },
  text: { flex: 1, gap: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
