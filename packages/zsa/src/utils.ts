import { z } from "zod"

export const instanceofZodTypeKind = (
  type: z.ZodTypeAny,
  zodTypeKind: string
): boolean => {
  return type?.type === zodTypeKind
}

export const unwrapZodType = (
  type: z.ZodTypeAny,
  unwrapPreprocess: boolean
): z.ZodTypeAny => {
  if (instanceofZodTypeKind(type, "optional")) {
    return unwrapZodType((type as any).unwrap(), unwrapPreprocess)
  }
  if (instanceofZodTypeKind(type, "default")) {
    return unwrapZodType((type as any).removeDefault(), unwrapPreprocess)
  }
  if (instanceofZodTypeKind(type, "lazy")) {
    return unwrapZodType((type as any)._zod.def.getter(), unwrapPreprocess)
  }
  // In v4, refinements are stored as checks in the schema, not as separate wrapper
  // ZodTransform represents standalone transforms
  // ZodPipe is used for preprocessing
  if (instanceofZodTypeKind(type, "pipe") && unwrapPreprocess) {
    return unwrapZodType((type as any)._zod.def.out, unwrapPreprocess)
  }
  return type
}

export const instanceofZodTypeObject = (
  type: z.ZodTypeAny
): type is z.ZodObject<z.ZodRawShape> => {
  return instanceofZodTypeKind(type, "object")
}

export const instanceofZodTypeArray = (
  type: z.ZodTypeAny
): type is z.ZodArray<z.ZodTypeAny> => {
  return instanceofZodTypeKind(type, "array")
}

export const instanceofZodTypeBoolean = (
  type: z.ZodTypeAny
): type is z.ZodBoolean => {
  return instanceofZodTypeKind(type, "boolean")
}

const unwrapKeyInZodSchema = (key: string, schema: z.ZodTypeAny) => {
  const unwrapped = unwrapZodType(schema, true)
  const isObject = instanceofZodTypeObject(unwrapped)

  if (!isObject) return null

  const shape = unwrapped.shape

  if (!(key in shape)) return null

  const value = shape[key]

  if (!value) return null

  return unwrapZodType(value as any, true)
}

export const isKeyAnArrayInZodSchema = (key: string, schema: z.ZodTypeAny) => {
  const unwrappedValue = unwrapKeyInZodSchema(key, schema)
  if (unwrappedValue === null) return false
  const isArray = instanceofZodTypeArray(unwrappedValue)

  return isArray
}

export const isKeyABooleanInZodSchema = (key: string, schema: z.ZodTypeAny) => {
  const unwrappedValue = unwrapKeyInZodSchema(key, schema)
  if (unwrappedValue === null) return false
  const isArray = instanceofZodTypeBoolean(unwrappedValue)

  return isArray
}

export const formDataToJson = (formData: FormData, inputSchema: z.ZodType) => {
  const json: Record<string, any> = {}

  formData.forEach((value, key) => {
    const isArraySchema = isKeyAnArrayInZodSchema(key, inputSchema)
    const isBooleanSchema = isKeyABooleanInZodSchema(key, inputSchema)

    // Reflect.has in favor of: object.hasOwnProperty(key)
    if (!Reflect.has(json, key)) {
      json[key] = isArraySchema ? [value] : value

      if (isBooleanSchema) {
        if (json[key] === "true") json[key] = true
        if (json[key] === "false") json[key] = false
      }

      return
    }

    if (!Array.isArray(json[key])) {
      json[key] = [json[key]]
    }
    json[key].push(value)
  })

  return json
}

export const addToNullishArray = (
  array: Array<any> | undefined,
  value: any | undefined
) => {
  if (!array && !value) return undefined
  if (!value) return array

  const temp = [...(array || [])]
  temp.push(value)

  return temp
}

export const mergeArraysAndRemoveDuplicates = <T>(
  array1: Array<T> | undefined,
  array2: Array<T> | undefined
) => {
  if (!array1 && !array2) return undefined
  if (!array2) return array1
  if (!array1) return array2

  const temp = [...(array1 || []), ...(array2 || [])]
  return [...new Set(temp)]
}

export type ZodTypeLikeVoid = z.ZodVoid | z.ZodUndefined | z.ZodNever

export const instanceofZodTypeLikeVoid = (
  type: z.ZodTypeAny
): type is ZodTypeLikeVoid => {
  return (
    instanceofZodTypeKind(type, "void") ||
    instanceofZodTypeKind(type, "undefined") ||
    instanceofZodTypeKind(type, "never")
  )
}

export const canDataBeUndefinedForSchema = (
  schema: z.ZodType | undefined
): boolean => {
  if (!schema) return true

  if (instanceofZodTypeLikeVoid(schema)) return true

  if (instanceofZodTypeKind(schema, "optional")) {
    return true
  }
  if (instanceofZodTypeKind(schema, "default")) {
    return true
  }

  if (instanceofZodTypeKind(schema, "lazy")) {
    return canDataBeUndefinedForSchema((schema as any)._zod.def.getter())
  }

  // In v4, refinements are stored as checks, not wrapper schemas
  // For pipes (preprocess), check the output schema
  if (instanceofZodTypeKind(schema, "pipe")) {
    return canDataBeUndefinedForSchema((schema as any)._zod.def.out)
  }

  return false
}
