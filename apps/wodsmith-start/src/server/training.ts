import { createTrainingService } from "./training-service"
import { getTrainingWebDependencies } from "./training-web-actor"

export async function requireTrainingAccess(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["requireTrainingAccess"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.requireTrainingAccess(...args)
}

export async function getTrainingContext(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["getTrainingContext"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.getTrainingContext(...args)
}

export async function getTrainingWeek(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["getTrainingWeek"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.getTrainingWeek(...args)
}

export async function saveTrainingDraft(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["saveTrainingDraft"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.saveTrainingDraft(...args)
}

export async function publishTrainingSession(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["publishTrainingSession"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.publishTrainingSession(...args)
}

export async function copyTrainingSession(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["copyTrainingSession"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.copyTrainingSession(...args)
}

export async function saveTrainingResult(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["saveTrainingResult"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.saveTrainingResult(...args)
}

export async function setTrainingCheer(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["setTrainingCheer"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.setTrainingCheer(...args)
}

export async function getTrainingHistory(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["getTrainingHistory"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.getTrainingHistory(...args)
}

export async function getTrainingWorkoutOptions(
  ...args: Parameters<
    ReturnType<typeof createTrainingService>["getTrainingWorkoutOptions"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.getTrainingWorkoutOptions(...args)
}

export async function getPersonalTrainingWorkoutOptions(
  ...args: Parameters<
    ReturnType<
      typeof createTrainingService
    >["getPersonalTrainingWorkoutOptions"]
  >
) {
  const service = createTrainingService(await getTrainingWebDependencies())
  return service.getPersonalTrainingWorkoutOptions(...args)
}
