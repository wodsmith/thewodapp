import { createPersonalTrainingService } from "./training-personal-service"
import { getTrainingWebDependencies } from "./training-web-actor"

export async function saveTrainingPreference(
  ...args: Parameters<
    ReturnType<typeof createPersonalTrainingService>["saveTrainingPreference"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.saveTrainingPreference(...args)
}

export async function getPersonalTrainingDay(
  ...args: Parameters<
    ReturnType<typeof createPersonalTrainingService>["getPersonalTrainingDay"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.getPersonalTrainingDay(...args)
}

export async function listTrainingLibraryWorkouts(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["listTrainingLibraryWorkouts"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.listTrainingLibraryWorkouts(...args)
}

export async function getTrainingLibraryWorkout(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["getTrainingLibraryWorkout"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.getTrainingLibraryWorkout(...args)
}

export async function savePersonalTrainingSession(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["savePersonalTrainingSession"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.savePersonalTrainingSession(...args)
}

export async function savePersonalTrainingResult(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["savePersonalTrainingResult"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.savePersonalTrainingResult(...args)
}

export async function linkPersonalTrainingScore(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["linkPersonalTrainingScore"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.linkPersonalTrainingScore(...args)
}

export async function savePersonalLibraryResult(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["savePersonalLibraryResult"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.savePersonalLibraryResult(...args)
}

export async function saveDirectLibraryResult(
  ...args: Parameters<
    ReturnType<typeof createPersonalTrainingService>["saveDirectLibraryResult"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.saveDirectLibraryResult(...args)
}

export async function getDirectLibraryEntry(
  ...args: Parameters<
    ReturnType<typeof createPersonalTrainingService>["getDirectLibraryEntry"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.getDirectLibraryEntry(...args)
}

export async function getPersonalTrainingHistory(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["getPersonalTrainingHistory"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.getPersonalTrainingHistory(...args)
}

export async function getPersonalLibraryScalingLevels(
  ...args: Parameters<
    ReturnType<
      typeof createPersonalTrainingService
    >["getPersonalLibraryScalingLevels"]
  >
) {
  const service = createPersonalTrainingService(
    await getTrainingWebDependencies(),
  )
  return service.getPersonalLibraryScalingLevels(...args)
}
