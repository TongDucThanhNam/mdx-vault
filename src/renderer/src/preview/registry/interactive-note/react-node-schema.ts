import type { ReactNode } from 'react'
import { z } from 'zod'

export const requiredReactNodeSchema = z.custom<ReactNode>(
  (value) => value !== undefined && value !== null,
  { message: 'children is required' }
)

export const optionalReactNodeSchema = requiredReactNodeSchema.optional()
