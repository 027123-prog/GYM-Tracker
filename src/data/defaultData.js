const now = new Date();

function isoOffset(daysAgo = 0) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

export const defaultData = {
  exercises: [
    { id: 'exercise-bench-press', name: 'Bankdrücken', weightOptions: [40, 50, 55, 60, 62.5, 65] },
    { id: 'exercise-row', name: 'Rudern Kabel', weightOptions: [35, 40, 45, 50] },
    { id: 'exercise-squat', name: 'Kniebeugen', weightOptions: [60, 70, 80, 90, 95] },
    { id: 'exercise-press', name: 'Schulterdrücken', weightOptions: [20, 22.5, 25, 27.5] },
    { id: 'exercise-rdl', name: 'Rum. Deadlift', weightOptions: [60, 70, 80, 90] },
    { id: 'exercise-zercher-squat', name: 'Zercher Squats', weightOptions: [40, 50, 60, 70] },
    { id: 'exercise-deadlift', name: 'Kreuzheben', weightOptions: [60, 80, 100, 120] },
    { id: 'exercise-reverse-flys', name: 'Reverse Flys', weightOptions: [5, 7.5, 10, 12.5] },
    { id: 'exercise-wide-lat-pulldown', name: 'Breites Latziehen', weightOptions: [35, 40, 45, 50] },
    { id: 'exercise-close-row', name: 'Enges Rudern', weightOptions: [35, 40, 45, 50] },
    { id: 'exercise-incline-bench', name: 'Schrägbankdrücken', weightOptions: [20, 30, 40, 50] },
    { id: 'exercise-cable-lateral-raise', name: 'Seitheben Kabel', weightOptions: [5, 7.5, 10, 12.5] },
    { id: 'exercise-calf-raise', name: 'Wadenheben (Isolation)', weightOptions: [20, 30, 40, 50] },
    { id: 'exercise-tbar-row', name: 'T-Bar Row (waagr. Griff)', weightOptions: [20, 30, 40, 50] },
    { id: 'exercise-standing-press', name: 'Schulterdrücken stehend', weightOptions: [20, 25, 30, 35] },
    { id: 'exercise-tibialis', name: 'Tibiales Training (Isolation)', weightOptions: [5, 10, 15, 20] },
  ],
  templates: [
    {
      id: 'template-upper',
      name: 'Upper Push/Pull',
      exerciseTemplates: [
        { exerciseId: 'exercise-bench-press', name: 'Bankdrücken' },
        { exerciseId: 'exercise-row', name: 'Rudern Kabel' },
        { exerciseId: 'exercise-press', name: 'Schulterdrücken' },
      ],
    },
    {
      id: 'template-lower',
      name: 'Lower Strength',
      exerciseTemplates: [
        { exerciseId: 'exercise-squat', name: 'Kniebeugen' },
        { exerciseId: 'exercise-rdl', name: 'Rum. Deadlift' },
      ],
    },
    {
      id: 'template-fullbody-a',
      name: 'Ganzkörper A',
      exerciseTemplates: [
        { exerciseId: 'exercise-zercher-squat', name: 'Zercher Squats', repScheme: '2 x 8' },
        { exerciseId: 'exercise-deadlift', name: 'Kreuzheben', repScheme: '2 x 8' },
        { exerciseId: 'exercise-reverse-flys', name: 'Reverse Flys', repScheme: '2 x 12' },
        { exerciseId: 'exercise-wide-lat-pulldown', name: 'Breites Latziehen', repScheme: '3 x 10' },
        { exerciseId: 'exercise-close-row', name: 'Enges Rudern', repScheme: '3 x 10' },
        { exerciseId: 'exercise-incline-bench', name: 'Schrägbankdrücken', repScheme: '3 x 8' },
        { exerciseId: 'exercise-cable-lateral-raise', name: 'Seitheben Kabel', repScheme: '3 x 12' },
        { exerciseId: 'exercise-calf-raise', name: 'Wadenheben (Isolation)', repScheme: '2 x 15' },
      ],
    },
    {
      id: 'template-fullbody-b',
      name: 'Ganzkörper B',
      exerciseTemplates: [
        { exerciseId: 'exercise-zercher-squat', name: 'Zercher Squats', repScheme: '2 x 8' },
        { exerciseId: 'exercise-deadlift', name: 'Kreuzheben', repScheme: '2 x 8' },
        { exerciseId: 'exercise-reverse-flys', name: 'Reverse Flys', repScheme: '2 x 12' },
        { exerciseId: 'exercise-wide-lat-pulldown', name: 'Breites Latziehen', repScheme: '3 x 10' },
        { exerciseId: 'exercise-tbar-row', name: 'T-Bar Row (waagr. Griff)', repScheme: '3 x 10' },
        { exerciseId: 'exercise-bench-press', name: 'Bankdrücken', repScheme: '3 x 8' },
        { exerciseId: 'exercise-standing-press', name: 'Schulterdrücken stehend', repScheme: '2 x 10' },
        { exerciseId: 'exercise-tibialis', name: 'Tibiales Training (Isolation)', repScheme: '2 x 15' },
      ],
    },
  ],
  workouts: [
    {
      id: 'workout-demo-1',
      name: 'Upper Focus',
      date: isoOffset(1),
      updatedAt: isoOffset(1),
      completedAt: isoOffset(1),
      mode: 'template',
      exercises: [
        {
          id: 'entry-demo-bench',
          exerciseId: 'exercise-bench-press',
          name: 'Bankdrücken',
          skipped: false,
          sets: [
            { id: 'set-demo-b1', weight: 60, reps: 8, savedAt: isoOffset(1) },
            { id: 'set-demo-b2', weight: 62.5, reps: 6, savedAt: isoOffset(1) },
            { id: 'set-demo-b3', weight: 55, reps: 10, savedAt: isoOffset(1) },
          ],
        },
        {
          id: 'entry-demo-row',
          exerciseId: 'exercise-row',
          name: 'Rudern Kabel',
          skipped: false,
          sets: [
            { id: 'set-demo-r1', weight: 45, reps: 10, savedAt: isoOffset(1) },
            { id: 'set-demo-r2', weight: 50, reps: 8, savedAt: isoOffset(1) },
          ],
        },
      ],
    },
    {
      id: 'workout-demo-2',
      name: 'Lower Volume',
      date: isoOffset(4),
      updatedAt: isoOffset(4),
      completedAt: isoOffset(4),
      mode: 'free',
      exercises: [
        {
          id: 'entry-demo-squat',
          exerciseId: 'exercise-squat',
          name: 'Kniebeugen',
          skipped: false,
          sets: [
            { id: 'set-demo-s1', weight: 90, reps: 5, savedAt: isoOffset(4) },
            { id: 'set-demo-s2', weight: 95, reps: 4, savedAt: isoOffset(4) },
            { id: 'set-demo-s3', weight: 80, reps: 8, savedAt: isoOffset(4) },
          ],
        },
      ],
    },
  ],
  meta: {
    lastSyncAt: null,
  },
};
