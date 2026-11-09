// Public user and skill types matching Go backend API
import type { DocumentationLink } from '../types/api'


export type PublicCategory = {
  slug: string
  name: string
  description: string
  sortOrder: number
}

export type PublicUser = {
  _id: string
  _creationTime: number
  handle: string
  name: string
  displayName: string
  image?: string | null
  bio?: string | null
}

export type PublicSkill = {
  _id: string
  _creationTime: number
  slug: string
  displayName: string
  summary?: string | null
  ownerUserId: string
  canonicalSkillId?: string | null
  forkOf?: {
    kind: 'fork' | 'duplicate'
    version: string | null
    skillId: string
  } | null
  latestVersionId?: string | null
  tags: string[]
  documentationLinks: DocumentationLink[]
  categories?: PublicCategory[]
  badges?: string[]
  highlighted?: boolean
  stats: {
    downloads: number
    installs: number
    versions: number
    stars?: number
  }
  createdAt: number
  updatedAt: number
}

export type PublicSoul = {
  _id: string
  _creationTime: number
  slug: string
  displayName: string
  summary?: string | null
  ownerUserId: string
  latestVersionId?: string | null
  tags: string[]
  stats: {
    downloads: number
    installs: number
    versions: number
  }
  createdAt: number
  updatedAt: number
}
