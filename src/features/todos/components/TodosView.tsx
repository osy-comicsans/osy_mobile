import { ActivityIndicator, FlatList, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { ThemedView } from '@/common/components/themed-view';
import { useTheme } from '@/common/hooks/use-theme';
import { BottomTabInset, MaxContentWidth } from '@/common/lib/theme';
import type { TodosController } from '../hooks/useTodosController';
import { TaskButton } from './TaskButton';
import { TodoItem } from './TodoItem';

export function TodosView({ controller }: { controller: TodosController }) {
  const theme = useTheme();
  const { status, todos, saving } = controller;
  return (
    <ThemedView style={styles.root}>
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
                <ThemedView type="backgroundElement" style={styles.status}>
                  <ThemedText>Open Tasks in the Android or iOS app to save tasks on your device.</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">This web preview does not store offline tasks.</ThemedText>
                </ThemedView>
              ) : (
                <>
                  <ThemedView type="backgroundElement" style={styles.status}>
                    <ThemedText type="smallBold">
                      {status.syncing ? 'Syncing changes…' : status.online === false ? 'You are offline' : 'Saved on this device'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {status.backendConnected
                        ? 'You can keep working while changes sync.'
                        : 'Cloud sync is not connected yet. Tasks stay on this device.'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {status.pending} change{status.pending === 1 ? '' : 's'} waiting to sync
                      {status.failed > 0 ? ` · ${status.failed} waiting to retry` : ''}
                      {status.conflicts > 0 ? ` · ${status.conflicts} need review` : ''}
                    </ThemedText>
                    {status.syncError && <ThemedText type="small" accessibilityRole="alert">{status.syncError}</ThemedText>}
                    <TaskButton label={status.failed > 0 ? 'Retry sync' : 'Sync now'} disabled={!controller.canSync} onPress={controller.syncNow} />
                  </ThemedView>
                  <View style={styles.composer}>
                    <ThemedText type="smallBold">{controller.editingId ? 'Edit task' : 'New task'}</ThemedText>
                    <TextInput
                      accessibilityLabel="Task title"
                      testID="task-title"
                      value={controller.draft}
                      onChangeText={controller.setDraft}
                      placeholder="What would you like to do?"
                      placeholderTextColor={theme.textSecondary}
                      maxLength={200}
                      editable={status.ready && !saving}
                      returnKeyType="done"
                      onSubmitEditing={controller.save}
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary }]}
                    />
                    <View style={styles.composerActions}>
                      {controller.editingId && <TaskButton label="Cancel" disabled={saving} onPress={controller.cancelEdit} />}
                      <TaskButton
                        label={saving ? 'Saving…' : controller.editingId ? 'Save task' : 'Add task'}
                        testID="save-task"
                        primary
                        disabled={!status.ready || saving || !controller.draft.trim()}
                        onPress={controller.save}
                      />
                    </View>
                  </View>
                </>
              )}
              {controller.error && (
                <View style={styles.status}>
                  <ThemedText accessibilityRole="alert">{controller.error}</ThemedText>
                  <TaskButton label="Try again" onPress={controller.retry} />
                </View>
              )}
              {controller.loading && <ActivityIndicator accessibilityLabel="Loading saved tasks" color={theme.text} />}
            </View>
          }
          ListEmptyComponent={status.supported && status.ready && !controller.loading && !controller.error ? (
            <View style={styles.empty}>
              <ThemedText>No tasks yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Add your first task above. Internet is optional.</ThemedText>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <TodoItem todo={item} disabled={saving} onToggle={controller.toggle} onEdit={controller.edit} onDelete={controller.deleteTodo} />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 128 : 24, paddingBottom: BottomTabInset + 40 },
  header: { gap: 24, marginBottom: 24 },
  intro: { gap: 8 },
  status: { borderRadius: 16, padding: 16, gap: 10 },
  composer: { gap: 10 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  empty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  separator: { height: 12 },
});
