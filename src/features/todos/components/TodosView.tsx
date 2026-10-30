import { ActivityIndicator, FlatList, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/common/components/ui/ambient-background';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { StatusPill, type StatusPillStatus } from '@/common/components/ui/status-pill';
import { ThemedText } from '@/common/components/themed-text';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/common/lib/theme';
import type { TodosController } from '../hooks/useTodosController';
import { TodoItem } from './TodoItem';

export function TodosView({ controller }: { controller: TodosController }) {
  const { status, todos, saving } = controller;

  const summary: { status: StatusPillStatus; label: string } = status.syncing
    ? { status: 'inProgress', label: 'Syncing changes…' }
    : status.online === false
      ? { status: 'pending', label: 'You are offline' }
      : status.failed > 0
        ? { status: 'escalated', label: 'Retry needed' }
        : status.conflicts > 0
          ? { status: 'rejected', label: 'Conflict review' }
          : { status: 'synced', label: 'Saved on this device' };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <FlatList
          data={todos}
          keyExtractor={(todo) => todo.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.intro}>
                <ThemedText type="subtitle">Tasks</ThemedText>
                <ThemedText themeColor="textSecondary">Your tasks, even without internet.</ThemedText>
              </View>
              {!status.supported ? (
                <Card tone="muted" style={styles.status}>
                  <ThemedText>Open Tasks in the Android or iOS app to save tasks on your device.</ThemedText>
                  <ThemedText type="label" themeColor="textTertiary">
                    This web preview does not store offline tasks.
                  </ThemedText>
                </Card>
              ) : (
                <>
                  <Card tone="muted" style={styles.status}>
                    <StatusPill status={summary.status} label={summary.label} />
                    <ThemedText type="label" themeColor="textSecondary">
                      {status.backendConnected
                        ? 'You can keep working while changes sync.'
                        : 'Cloud sync is not connected yet. Tasks stay on this device.'}
                    </ThemedText>
                    <ThemedText type="label" themeColor="textTertiary">
                      {status.pending} change{status.pending === 1 ? '' : 's'} waiting to sync
                      {status.failed > 0 ? ` · ${status.failed} waiting to retry` : ''}
                      {status.conflicts > 0 ? ` · ${status.conflicts} need review` : ''}
                    </ThemedText>
                    {status.syncError && (
                      <ThemedText type="label" accessibilityRole="alert" themeColor="errorText">
                        {status.syncError}
                      </ThemedText>
                    )}
                    <Button
                      label={status.failed > 0 ? 'Retry sync' : 'Sync now'}
                      variant="secondary"
                      size="small"
                      disabled={!controller.canSync}
                      onPress={controller.syncNow}
                    />
                  </Card>
                  <Card style={styles.composer}>
                    <ThemedText type="bodyMedium">
                      {controller.editingId ? 'Edit task' : 'New task'}
                    </ThemedText>
                    <Input
                      accessibilityLabel="Task title"
                      testID="task-title"
                      label="Task"
                      value={controller.draft}
                      onChangeText={controller.setDraft}
                      placeholder="What would you like to do?"
                      maxLength={200}
                      editable={status.ready && !saving}
                      returnKeyType="done"
                      onSubmitEditing={controller.save}
                    />
                    <View style={styles.composerActions}>
                      {controller.editingId && (
                        <Button
                          label="Cancel"
                          variant="secondary"
                          size="small"
                          disabled={saving}
                          onPress={controller.cancelEdit}
                        />
                      )}
                      <Button
                        label={saving ? 'Saving…' : controller.editingId ? 'Save task' : 'Add task'}
                        testID="save-task"
                        size="small"
                        loading={saving}
                        disabled={!status.ready || saving || !controller.draft.trim()}
                        onPress={controller.save}
                      />
                    </View>
                  </Card>
                </>
              )}
              {controller.error && (
                <Card tone="muted" style={styles.status}>
                  <ThemedText accessibilityRole="alert">{controller.error}</ThemedText>
                  <Button label="Try again" variant="secondary" size="small" onPress={controller.retry} />
                </Card>
              )}
              {controller.loading && (
                <ActivityIndicator accessibilityLabel="Loading saved tasks" color={Colors.accent} />
              )}
            </View>
          }
          ListEmptyComponent={
            status.supported && status.ready && !controller.loading && !controller.error ? (
              <View style={styles.empty}>
                <ThemedText type="headingS">No tasks yet</ThemedText>
                <ThemedText type="label" themeColor="textTertiary">
                  Add your first task above. Internet is optional.
                </ThemedText>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <TodoItem
              todo={item}
              disabled={saving}
              onToggle={controller.toggle}
              onEdit={controller.edit}
              onDelete={controller.deleteTodo}
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 128 : 24,
    paddingBottom: BottomTabInset + 40,
  },
  header: { gap: Spacing.four, marginBottom: Spacing.four },
  intro: { gap: Spacing.two },
  status: { gap: Spacing.three, padding: Spacing.four },
  composer: { gap: Spacing.three, padding: Spacing.four },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  empty: { paddingVertical: Spacing.five, alignItems: 'center', gap: Spacing.two },
  separator: { height: Spacing.three },
});
