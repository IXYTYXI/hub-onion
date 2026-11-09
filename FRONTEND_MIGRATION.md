# Frontend Migration Guide

## Overview

This guide documents the migration from Convex to TanStack Query + Go Backend.

## Completed

### Infrastructure (✅ Complete)
- ✅ Installed @tanstack/react-query and devtools
- ✅ Created API client (`src/lib/api-client.ts`)
- ✅ Updated AppProviders with QueryClientProvider
- ✅ Created all query hooks:
  - `useSkills` - List skills with pagination
  - `useSkill` - Get skill detail
  - `useSkillVersions` - Get version history
  - `useSearchSkills` - Search with debouncing
  - `usePublishSkill` - Publish mutation
  - `useDeleteSkill` - Delete mutation
  - `useUndeleteSkill` - Undelete mutation

## Migration Pattern

### Before (Convex)
```tsx
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

const skills = useQuery(api.skills.listPublicPageV2, { limit: 25 })
```

### After (TanStack Query)
```tsx
import { useSkills } from '../hooks/useSkills'

const { data: skills, isLoading, error } = useSkills({ limit: 25 })
```

## Files Requiring Migration

### High Priority (Core Functionality)
1. **src/routes/skills/index.tsx** - Skills browse page
   - Uses: `usePaginatedQuery`, `useAction`
   - Replace with: `useSkills`, `useSearchSkills`
   - Note: Complex pagination and search logic in `-useSkillsBrowseModel.ts`

2. **src/routes/upload.tsx** - Skill upload/publish
   - Uses: `useMutation`
   - Replace with: `usePublishSkill`

3. **src/components/SkillDetailPage.tsx** - Skill detail view
   - Uses: `useQuery`, `useMutation`, `useAction`
   - Replace with: `useSkill`, `useSkillVersions`
   - Note: Contains auth/moderation features (Phase 1: disable)

### Medium Priority (Supporting Features)
4. **src/routes/skills/-useSkillsBrowseModel.ts** - Browse logic
   - Complex search, sort, filter logic
   - Needs significant refactoring

5. **src/components/SkillFilesPanel.tsx** - File browser
6. **src/components/SkillCommentsPanel.tsx** - Comments (Phase 1: disable)
7. **src/components/SkillDiffCard.tsx** - Version diff

### Low Priority (Auth/Admin Features - Phase 1: Disable)
8. **src/routes/dashboard.tsx** - User dashboard
9. **src/routes/management.tsx** - Admin panel
10. **src/routes/settings.tsx** - User settings
11. **src/routes/stars.tsx** - Starred skills
12. **src/routes/u/$handle.tsx** - User profile
13. **src/components/UserBootstrap.tsx** - Auth bootstrap
14. **src/lib/useAuthStatus.ts** - Auth status hook

### Other Files
15. **src/routes/index.tsx** - Home page
16. **src/routes/import.tsx** - Import feature
17. **src/routes/cli/auth.tsx** - CLI auth (Phase 1: 501)
18. **src/routes/souls/index.tsx** - Souls feature
19. **src/components/SoulDetailPage.tsx** - Soul detail
20. **src/convex/client.ts** - Convex client (delete after migration)

## Phase 1 Strategy

### Approach 1: Minimal Migration (Recommended)
Focus on core skill browsing and publishing:
1. Migrate skills list page (browse/search)
2. Migrate skill detail page (read-only)
3. Migrate upload page (publish)
4. Disable/hide all auth-dependent features
5. Keep other pages as-is (show "Coming in Phase 2" message)

### Approach 2: Full Migration
Migrate all 20 files, disabling auth features:
- More work upfront
- Cleaner codebase
- Removes all Convex dependencies

## Auth UI Handling (Task 15)

For Phase 1, auth-dependent UI should be:
1. **Hidden** - Remove from UI entirely
2. **Disabled** - Show but make non-interactive
3. **Placeholder** - Show "Available in Phase 2" message

Examples:
- Login/signup buttons → Hide
- Star/favorite buttons → Hide
- Comments section → Show placeholder
- User profiles → Show placeholder
- Admin features → Hide completely

## Next Steps

1. Choose migration approach (Minimal vs Full)
2. Start with skills list page migration
3. Test each component after migration
4. Update error handling for new API errors
5. Remove Convex imports progressively
6. Delete `src/convex/client.ts` when done

## Testing Checklist

After each component migration:
- [ ] Component renders without errors
- [ ] Loading states work correctly
- [ ] Error states display properly
- [ ] Data fetching works
- [ ] Mutations trigger cache invalidation
- [ ] No Convex imports remain
