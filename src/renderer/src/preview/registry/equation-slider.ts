import { z } from 'zod'

import { EquationSlider } from '../islands/EquationSlider'
import { defineRegistryEntry } from './types'

const variableNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, {
  message: 'Variable names must be valid identifiers'
})

const equationVariableConfigSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    default: z.number(),
    step: z.number().positive()
  })
  .strict()
  .superRefine((config, context) => {
    if (config.min >= config.max) {
      context.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'min must be smaller than max'
      })
    }

    if (config.default < config.min || config.default > config.max) {
      context.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'default must be inside the slider range'
      })
    }
  })

const equationSliderPropsSchema = z
  .object({
    formula: z.string().min(1),
    compute: z.string().min(1).optional(),
    variables: z.record(variableNameSchema, equationVariableConfigSchema)
  })
  .strict()
  .superRefine((props, context) => {
    if (Object.keys(props.variables).length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['variables'],
        message: 'At least one variable is required'
      })
    }
  })

export const equationSliderRegistryEntry = defineRegistryEntry({
  name: 'EquationSlider',
  component: EquationSlider,
  propsSchema: equationSliderPropsSchema,
  description: 'Sliders for variables that update a parsed arithmetic expression and mini chart.',
  category: 'data',
  defaultProps: {
    formula: 'y = m * x + b',
    compute: 'm * x + b',
    variables: {
      x: { min: -10, max: 10, default: 2, step: 0.5 },
      m: { min: -5, max: 5, default: 1.5, step: 0.1 },
      b: { min: -10, max: 10, default: 1, step: 0.5 }
    }
  },
  insertSnippet: `<EquationSlider
  formula="y = m * x + b"
  compute="m * x + b"
  variables={{
    x: { min: -10, max: 10, default: 2, step: 0.5 },
    m: { min: -5, max: 5, default: 1.5, step: 0.1 },
    b: { min: -10, max: 10, default: 1, step: 0.5 }
  }}
/>`
})
