import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Checkbox } from '@/common/components/ui/checkbox';
import { ThemedText } from '@/common/components/themed-text';
import { Spacing } from '@/common/lib/theme';
import type { Todo } from '../types/todo';

interface TodoItemProps {
  todo: Todo;
  disabled: boolean;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const syncLabels = {
  pending: 'Saved on this device',
  failed: 'Waiting to retry sync',
  conflict: 'Needs conflict review',
  synced: 'Synced',
};

export const TodoItem = memo(function TodoItem({ todo, disabled, onToggle, onEdit, onDelete }: TodoItemProps) {
  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.task}>
        <Checkbox
          checked={todo.completed}
          onPress={() => onToggle(todo)}
          disabled={disabled}
          accessibilityLabel={todo.title}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={todo.title}
          disabled={disabled}
          onPress={() => onToggle(todo)}
          style={styles.text}>
          <ThemedText type="bodyMedium" style={todo.completed ? styles.completed : undefined}>
            {todo.title}
          </ThemedText>
          <ThemedText type="label" themeColor="textTertiary">
            {syncLabels[todo.syncState]}
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Button
          label="Edit"
          accessibilityLabel={`Edit ${todo.title}`}
          variant="subtle"
          size="small"
          disabled={disabled}
          onPress={() => onEdit(todo)}
        />
        <Button
          label="Delete"
          accessibilityLabel={`Delete ${todo.title}`}
          variant="text"
          size="small"
          disabled={disabled}
          onPress={() => onDelete(todo)}
        />
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { padding: Spacing.four, gap: Spacing.two },
  task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
