import { z } from 'zod';

// Team invitation validation schema
export const teamInvitationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  roleId: z
    .string()
    .min(1, 'Role is required')
    .uuid('Invalid role ID'),
  message: z
    .string()
    .max(500, 'Message is too long')
    .optional(),
});

// Project validation schemas
export const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name is too long')
    .trim(),
  description: z
    .string()
    .max(500, 'Description is too long')
    .optional(),
});

// User profile validation schema
export const profileSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name is too long')
    .trim(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  avatar_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),
});

// Task validation schema
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(200, 'Task title is too long')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description is too long')
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  due_date: z
    .string()
    .datetime()
    .optional()
    .or(z.literal('')),
  assigned_to: z
    .string()
    .uuid('Invalid user ID')
    .optional()
    .or(z.literal('')),
});

export type TeamInvitationInput = z.infer<typeof teamInvitationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type TaskInput = z.infer<typeof taskSchema>;