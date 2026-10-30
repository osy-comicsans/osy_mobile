import { z } from 'zod';

export const todoTitleSchema = z.string().trim().min(1, 'Enter a task title.').max(200, 'Use 200 characters or fewer.');

export const remoteTodoSchema = z.object({
  id: z.string().min(1),
  title: todoTitleSchema,
  completed: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  deletedAt: z.string().datetime({ offset: true }).nullable(),
});

export type RemoteTodo = z.infer<typeof remoteTodoSchema>;
export type TodoSyncState = 'pending' | 'failed' | 'conflict' | 'synced';

export interface Todo extends RemoteTodo {
  revision: number;
  syncState: TodoSyncState;
}

export interface TodoUpdate {
  title?: string;
  completed?: boolean;
}
