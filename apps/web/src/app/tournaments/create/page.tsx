'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Trophy,
  Gamepad2,
  Users,
  DollarSign,
  Calendar,
  FileText,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { TOURNAMENT_FORMATS, PLATFORMS, GAME_CATEGORIES } from '@/lib/constants';

const tournamentSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  description: z.string().max(2000).optional(),
  gameId: z.string().min(1, 'Please select a game'),
  format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS']),
  bracketType: z.enum(['SOLO', 'TEAM']),
  teamSize: z.number().min(1).max(10),
  maxParticipants: z.number().min(2).max(512),
  entryFee: z.number().min(0).max(1000),
  startDate: z.string().min(1, 'Please select a start date'),
  registrationEnd: z.string().optional(),
  rules: z.string().max(5000).optional(),
});

type TournamentForm = z.infer<typeof tournamentSchema>;

// Mock games - will be fetched from API
const games = [
  { id: '1', name: 'EA Sports FC 25', platform: 'PS5', category: 'SPORTS' },
  { id: '2', name: 'Call of Duty: Warzone', platform: 'CROSS_PLATFORM', category: 'SHOOTER' },
  { id: '3', name: 'Tekken 8', platform: 'PS5', category: 'FIGHTING' },
  { id: '4', name: 'NBA 2K25', platform: 'CROSS_PLATFORM', category: 'SPORTS' },
  { id: '5', name: 'Street Fighter 6', platform: 'PS5', category: 'FIGHTING' },
  { id: '6', name: 'Fortnite', platform: 'CROSS_PLATFORM', category: 'BATTLE_ROYALE' },
  { id: '7', name: 'Madden NFL 25', platform: 'CROSS_PLATFORM', category: 'SPORTS' },
  { id: '8', name: 'Mortal Kombat 1', platform: 'PS5', category: 'FIGHTING' },
];

const steps = [
  { id: 'basics', title: 'Basics', icon: Trophy },
  { id: 'format', title: 'Format', icon: Users },
  { id: 'details', title: 'Details', icon: FileText },
  { id: 'review', title: 'Review', icon: ChevronRight },
];

export default function CreateTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TournamentForm>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      format: 'SINGLE_ELIMINATION',
      bracketType: 'SOLO',
      teamSize: 1,
      maxParticipants: 16,
      entryFee: 0,
    },
  });

  const formData = watch();

  const onSubmit = async (data: TournamentForm) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create tournament');
      }

      const result = await response.json();
      router.push(`/tournaments/${result.id}`);
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const selectedGame = games.find((g) => g.id === formData.gameId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create Tournament</h1>
        <p className="text-dark-400">Set up your competitive gaming event</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                i === step
                  ? 'bg-primary-600 text-white'
                  : i < step
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'bg-dark-800 text-dark-400'
              }`}
            >
              <s.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{s.title}</span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`w-8 md:w-16 h-0.5 mx-2 ${
                  i < step ? 'bg-primary-600' : 'bg-dark-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card">
          {/* Step 1: Basics */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="label">
                  Tournament Name *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  id="name"
                  placeholder="e.g., Weekend Warriors Championship"
                  className="input"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="gameId" className="label">
                  Game *
                </label>
                <select {...register('gameId')} id="gameId" className="input">
                  <option value="">Select a game</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} ({game.platform})
                    </option>
                  ))}
                </select>
                {errors.gameId && (
                  <p className="mt-1 text-sm text-red-400">{errors.gameId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="label">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  id="description"
                  rows={4}
                  placeholder="Describe your tournament, prizes, and any special rules..."
                  className="input resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Format */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="label mb-3">Tournament Format *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TOURNAMENT_FORMATS.map((format) => (
                    <label
                      key={format.value}
                      className={`card cursor-pointer transition-all ${
                        formData.format === format.value
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'hover:border-dark-600'
                      }`}
                    >
                      <input
                        type="radio"
                        {...register('format')}
                        value={format.value}
                        className="sr-only"
                      />
                      <div className="font-medium text-white mb-1">{format.label}</div>
                      <div className="text-sm text-dark-400">{format.description}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label mb-3">Bracket Type *</label>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`card cursor-pointer transition-all ${
                      formData.bracketType === 'SOLO'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'hover:border-dark-600'
                    }`}
                  >
                    <input
                      type="radio"
                      {...register('bracketType')}
                      value="SOLO"
                      className="sr-only"
                      onChange={() => setValue('teamSize', 1)}
                    />
                    <Users className="w-8 h-8 text-primary-400 mb-2" />
                    <div className="font-medium text-white">Solo (1v1)</div>
                    <div className="text-sm text-dark-400">Individual competition</div>
                  </label>
                  <label
                    className={`card cursor-pointer transition-all ${
                      formData.bracketType === 'TEAM'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'hover:border-dark-600'
                    }`}
                  >
                    <input
                      type="radio"
                      {...register('bracketType')}
                      value="TEAM"
                      className="sr-only"
                    />
                    <Users className="w-8 h-8 text-primary-400 mb-2" />
                    <div className="font-medium text-white">Team</div>
                    <div className="text-sm text-dark-400">Team-based competition</div>
                  </label>
                </div>
              </div>

              {formData.bracketType === 'TEAM' && (
                <div>
                  <label htmlFor="teamSize" className="label">
                    Team Size
                  </label>
                  <select
                    {...register('teamSize', { valueAsNumber: true })}
                    id="teamSize"
                    className="input w-32"
                  >
                    {[2, 3, 4, 5, 6].map((size) => (
                      <option key={size} value={size}>
                        {size} players
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="maxParticipants" className="label">
                  Maximum Participants
                </label>
                <select
                  {...register('maxParticipants', { valueAsNumber: true })}
                  id="maxParticipants"
                  className="input w-32"
                >
                  {[4, 8, 16, 32, 64, 128, 256].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="startDate" className="label">
                    Start Date & Time *
                  </label>
                  <input
                    {...register('startDate')}
                    type="datetime-local"
                    id="startDate"
                    className="input"
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-400">{errors.startDate.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="registrationEnd" className="label">
                    Registration Deadline
                  </label>
                  <input
                    {...register('registrationEnd')}
                    type="datetime-local"
                    id="registrationEnd"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="entryFee" className="label">
                  Entry Fee (USD)
                </label>
                <div className="relative w-48">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    {...register('entryFee', { valueAsNumber: true })}
                    type="number"
                    id="entryFee"
                    min="0"
                    max="1000"
                    step="0.01"
                    className="input pl-10"
                  />
                </div>
                <p className="mt-1 text-sm text-dark-400">
                  {formData.entryFee > 0
                    ? `Prize pool: $${(formData.entryFee * formData.maxParticipants * 0.9).toFixed(2)} (90% of entry fees)`
                    : 'Set to 0 for a free tournament'}
                </p>
              </div>

              <div>
                <label htmlFor="rules" className="label">
                  Rules & Regulations
                </label>
                <textarea
                  {...register('rules')}
                  id="rules"
                  rows={6}
                  placeholder="Enter tournament rules, match format, dispute resolution, etc..."
                  className="input resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-4">Review Your Tournament</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-dark-400">Tournament Name</div>
                    <div className="text-white font-medium">{formData.name || '—'}</div>
                  </div>

                  <div>
                    <div className="text-sm text-dark-400">Game</div>
                    <div className="text-white font-medium">
                      {selectedGame?.name || '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-dark-400">Format</div>
                    <div className="text-white font-medium">
                      {TOURNAMENT_FORMATS.find((f) => f.value === formData.format)?.label}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-dark-400">Bracket Type</div>
                    <div className="text-white font-medium">
                      {formData.bracketType === 'SOLO'
                        ? 'Solo (1v1)'
                        : `Team (${formData.teamSize} players)`}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-dark-400">Max Participants</div>
                    <div className="text-white font-medium">{formData.maxParticipants}</div>
                  </div>

                  <div>
                    <div className="text-sm text-dark-400">Start Date</div>
                    <div className="text-white font-medium">
                      {formData.startDate
                        ? new Date(formData.startDate).toLocaleString()
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-dark-400">Entry Fee</div>
                    <div className="text-white font-medium">
                      {formData.entryFee > 0 ? `$${formData.entryFee}` : 'Free'}
                    </div>
                  </div>

                  {formData.entryFee > 0 && (
                    <div>
                      <div className="text-sm text-dark-400">Prize Pool</div>
                      <div className="text-green-400 font-medium">
                        ${(formData.entryFee * formData.maxParticipants * 0.9).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {formData.description && (
                <div>
                  <div className="text-sm text-dark-400 mb-1">Description</div>
                  <div className="text-white text-sm">{formData.description}</div>
                </div>
              )}

              {formData.rules && (
                <div>
                  <div className="text-sm text-dark-400 mb-1">Rules</div>
                  <div className="text-white text-sm whitespace-pre-wrap">
                    {formData.rules}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-dark-700">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 0}
              className="btn-outline"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>

            {step < steps.length - 1 ? (
              <button type="button" onClick={nextStep} className="btn-primary">
                Continue
                <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5 mr-2" />
                    Create Tournament
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
