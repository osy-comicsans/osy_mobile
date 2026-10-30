import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { z } from 'zod';

import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import type { Todo, TodoUpdate } from '../types/todo';
import { useCreateTodo } from './useCreateTodo';
import { useTodos } from './useTodos';

export function useTodosController() {
  const runtime = useOfflineRuntime();
  const status = useOfflineStatus();
  const query = useTodos();
  const create = useCreateTodo();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const submitting = useRef(false);
  const saving = useIsMutating({ mutationKey: ['local', 'todos'] }) > 0;

  const onSuccess = () => {
    void runtime.changed();
    void runtime.sync.requestSync();
  };
  const update = useMutation({
    mutationKey: ['local', 'todos'],
    mutationFn: ({ id, patch }: { id: string; patch: TodoUpdate }) => runtime.todos.update(id, patch),
    networkMode: 'always', onSuccess,
  });
  const remove = useMutation({
    mutationKey: ['local', 'todos'],
    mutationFn: (id: string) => runtime.todos.delete(id),
    networkMode: 'always', onSuccess,
  });

  const reportError = (error: unknown) => {
    setActionError(error instanceof z.ZodError ? error.issues[0].message : 'Could not save this change. Please try again.');
  };

  return {
    todos: query.data ?? [], draft, editingId, saving, status,
    loading: status.supported && (!status.ready || query.isPending) && !status.error,
    error: actionError ?? status.error ?? (query.isError ? 'Could not read your saved tasks. Try again.' : null),
    canSync: status.ready && status.backendConnected && status.online === true && !status.syncing,
    setDraft,
    async save() {
      if (submitting.current || saving || !status.ready) return;
      submitting.current = true;
      setActionError(null);
      try {
        if (editingId) await update.mutateAsync({ id: editingId, patch: { title: draft } });
        else await create.mutateAsync(draft);
        setDraft('');
        setEditingId(null);
      } catch (error) {
        reportError(error);
      } finally {
        submitting.current = false;
      }
    },
    edit(todo: Todo) {
      setEditingId(todo.id);
      setDraft(todo.title);
      setActionError(null);
    },
    cancelEdit() {
      setEditingId(null);
      setDraft('');
      setActionError(null);
    },
    async toggle(todo: Todo) {
      setActionError(null);
      try {
        await update.mutateAsync({ id: todo.id, patch: { completed: !todo.completed } });
      } catch (error) {
        reportError(error);
      }
    },
    async deleteTodo(todo: Todo) {
      setActionError(null);
      try {
        await remove.mutateAsync(todo.id);
        if (editingId === todo.id) {
          setEditingId(null);
          setDraft('');
        }
      } catch (error) {
        reportError(error);
      }
    },
    async retry() {
      setActionError(null);
      try {
        await runtime.initialize();
        await runtime.changed();
        await query.refetch();
      } catch {
        setActionError('Could not open local storage. Please try again.');
      }
    },
    async syncNow() {
      try {
        await runtime.syncNow();
      } catch {
        setActionError('Could not start sync. Your changes are still saved locally.');
      }
    },
  };
}

export type TodosController = ReturnType<typeof useTodosController>;
