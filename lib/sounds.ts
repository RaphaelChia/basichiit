/**
 * Sound utilities for HIIT timer using Web Audio API
 */

// Create audio context (singleton pattern)
let audioContext: AudioContext | null = null

async function getAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  
  // Resume audio context if it's suspended (required for autoplay policies)
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
    } catch (error) {
      console.warn('Failed to resume audio context:', error)
    }
  }
  
  return audioContext
}

/**
 * Initialize audio context (should be called on user interaction)
 * This ensures audio works in browsers with strict autoplay policies
 */
export async function initializeAudio(): Promise<void> {
  await getAudioContext()
}

/**
 * Play a beep sound
 * @param frequency - Frequency in Hz (default: 800)
 * @param duration - Duration in milliseconds (default: 200)
 * @param volume - Volume from 0 to 1 (default: 0.5)
 */
async function playBeep(frequency: number = 800, duration: number = 200, volume: number = 0.5): Promise<void> {
  try {
    const ctx = await getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch (error) {
    console.warn('Failed to play beep:', error)
  }
}

/**
 * Play a long beep to signify active stage has started (rest -> work)
 */
export function playActiveStartBeep(): void {
  playBeep(800, 600, 0.7) // Long, loud beep
}

/**
 * Play 3 quick short beeps to signify rest stage has started (work -> rest)
 */
export function playRestStartBeeps(): void {
  const beepDuration = 100
  const beepGap = 80
  const frequency = 600
  const volume = 0.5

  playBeep(frequency, beepDuration, volume)
  setTimeout(() => playBeep(frequency, beepDuration, volume), beepDuration + beepGap)
  setTimeout(() => playBeep(frequency, beepDuration, volume), (beepDuration + beepGap) * 2)
}

/**
 * Play a congratulations sound when workout completes
 * Creates a pleasant ascending melody
 */
export async function playCongratulationsSound(): Promise<void> {
  try {
    const ctx = await getAudioContext()
    const notes = [
      { freq: 523.25, duration: 150 }, // C5
      { freq: 659.25, duration: 150 }, // E5
      { freq: 783.99, duration: 150 }, // G5
      { freq: 1046.50, duration: 300 }, // C6 (longer)
    ]

    notes.forEach((note, index) => {
      setTimeout(() => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = note.freq
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0, ctx.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.duration / 1000)

        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + note.duration / 1000)
      }, index * 180) // Stagger the notes slightly
    })
  } catch (error) {
    console.warn('Failed to play congratulations sound:', error)
  }
}

