/**
 * Registration Components Export
 *
 * This module exports the WaiverSigningStep component for integration
 * with the registration flow. The main registration route is in register.tsx.
 *
 * ## Integration Guide
 *
 * To fully integrate waivers into the registration flow:
 *
 * 1. Update register.tsx loader to fetch waivers:
 *    ```ts
 *    import {getCompetitionWaiversFn} from '@/server-fns/waiver-fns'
 *    // In loader:
 *    const {waivers} = await getCompetitionWaiversFn({
 *      data: {competitionId: competition.id}
 *    })
 *    // Add waivers to return value
 *    ```
 *
 * 2. Update RegistrationForm component to accept waivers prop:
 *    ```ts
 *    type Props = {
 *      // ... existing props
 *      waivers: Waiver[]
 *    }
 *    ```
 *
 * 3. Add step state and render WaiverSigningStep before payment:
 *    ```tsx
 *    import {WaiverSigningStep} from './register'
 *
 *    const [currentStep, setCurrentStep] = useState<'form' | 'waivers' | 'payment'>('form')
 *
 *    // In onSubmit, check for waivers before payment:
 *    if (waivers.length > 0) {
 *      setCurrentStep('waivers')
 *      return
 *    }
 *
 *    // Render waiver step:
 *    if (currentStep === 'waivers') {
 *      return (
 *        <WaiverSigningStep
 *          waivers={waivers}
 *          onComplete={() => proceedToPayment()}
 *        />
 *      )
 *    }
 *    ```
 *
 * @see ../register.tsx - Main registration route
 * @see ./-components/waiver-signing-step.tsx - Waiver signing component
 */

// Re-export the WaiverSigningStep component for use in the registration flow
export { WaiverSigningStep } from "./-components/waiver-signing-step"
