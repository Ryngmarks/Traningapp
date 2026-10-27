import type { RouteObject } from 'react-router'
import { ActivityDetailScreen } from '@/features/activity/ActivityDetailScreen'
import { ActivityFormScreen } from '@/features/activity/ActivityFormScreen'
import { ActivityScreen } from '@/features/activity/ActivityScreen'
import { OverviewScreen } from '@/features/overview/OverviewScreen'
import { HistoricalTotalsScreen } from '@/features/settings/HistoricalTotalsScreen'
import { ImportScreen } from '@/features/settings/ImportScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ExerciseStatsScreen } from '@/features/stats/ExerciseStatsScreen'
import { StatsScreen } from '@/features/stats/StatsScreen'
import { ExerciseLibraryScreen } from '@/features/train/ExerciseLibraryScreen'
import { TemplateEditorScreen } from '@/features/train/TemplateEditorScreen'
import { TrainScreen } from '@/features/train/TrainScreen'
import { ActiveWorkoutScreen } from '@/features/workout/ActiveWorkoutScreen'
import { AppShell } from './AppShell'

// URL map (Swedish paths, see docs/ARCHITECTURE.md).
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewScreen /> },
      { path: 'traning', element: <TrainScreen /> },
      { path: 'traning/pass', element: <ActiveWorkoutScreen /> },
      { path: 'traning/mallar/ny', element: <TemplateEditorScreen /> },
      { path: 'traning/mallar/:id', element: <TemplateEditorScreen /> },
      { path: 'traning/ovningar', element: <ExerciseLibraryScreen /> },
      { path: 'aktivitet', element: <ActivityScreen /> },
      { path: 'aktivitet/ny', element: <ActivityFormScreen /> },
      { path: 'aktivitet/:id', element: <ActivityDetailScreen /> },
      { path: 'aktivitet/:id/redigera', element: <ActivityFormScreen /> },
      { path: 'statistik', element: <StatsScreen /> },
      { path: 'statistik/ovning/:id', element: <ExerciseStatsScreen /> },
      { path: 'installningar', element: <SettingsScreen /> },
      { path: 'installningar/historik', element: <HistoricalTotalsScreen /> },
      { path: 'installningar/import', element: <ImportScreen /> },
    ],
  },
]
