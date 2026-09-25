import { useCallback, useEffect, useState } from 'react'
import { formatError } from '@/lib/format-error'
import type {
  BacklinkResult,
  IndexedNoteSummary,
  NoteHeadingResult,
  NoteTemplate,
  TagSummary,
  VaultInfo
} from '@/vault/types'

interface UseNoteIndexOptions {
  vault: VaultInfo | null
  selectedPath: string | null
  onError: (message: string | null) => void
}

export function useNoteIndex({ vault, selectedPath, onError }: UseNoteIndexOptions) {
  const [indexNotes, setIndexNotes] = useState<IndexedNoteSummary[]>([])
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([])
  const [backlinksState, setBacklinksState] = useState<{
    relativePath: string | null
    backlinks: BacklinkResult[]
  }>({
    relativePath: null,
    backlinks: []
  })
  const [outlineState, setOutlineState] = useState<{
    relativePath: string | null
    headings: NoteHeadingResult[]
  }>({
    relativePath: null,
    headings: []
  })
  const [tags, setTags] = useState<TagSummary[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [taggedNotes, setTaggedNotes] = useState<IndexedNoteSummary[]>([])
  const [isLoadingTaggedNotes, setIsLoadingTaggedNotes] = useState(false)
  const [indexRevision, setIndexRevision] = useState(0)

  const bumpIndexRevision = useCallback((): void => {
    setIndexRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    let cancelled = false

    void window.indexApi
      .backlinks(selectedPath)
      .then((nextBacklinks) => {
        if (!cancelled) {
          setBacklinksState({
            relativePath: selectedPath,
            backlinks: nextBacklinks
          })
        }
      })
      .catch((backlinksError: unknown) => {
        if (!cancelled) {
          setBacklinksState({
            relativePath: selectedPath,
            backlinks: []
          })
          onError(formatError(backlinksError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, onError, selectedPath])

  useEffect(() => {
    if (!selectedPath) {
      queueMicrotask(() => {
        setOutlineState({
          relativePath: null,
          headings: []
        })
      })
      return
    }

    let cancelled = false

    void window.indexApi
      .headingsOfNote(selectedPath)
      .then((headings) => {
        if (!cancelled) {
          setOutlineState({
            relativePath: selectedPath,
            headings
          })
        }
      })
      .catch((outlineError: unknown) => {
        if (!cancelled) {
          setOutlineState({
            relativePath: selectedPath,
            headings: []
          })
          onError(formatError(outlineError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, onError, selectedPath])

  useEffect(() => {
    if (!vault) {
      queueMicrotask(() => {
        setTags([])
        setSelectedTag(null)
        setTaggedNotes([])
      })
      return
    }

    let cancelled = false

    void window.indexApi
      .tags()
      .then((nextTags) => {
        if (cancelled) {
          return
        }

        setTags(nextTags)
        setSelectedTag((currentTag) =>
          currentTag && nextTags.some((tag) => tag.tag === currentTag) ? currentTag : null
        )
      })
      .catch((tagsError: unknown) => {
        if (!cancelled) {
          setTags([])
          onError(formatError(tagsError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, onError, vault])

  useEffect(() => {
    if (!vault) {
      queueMicrotask(() => {
        setNoteTemplates([])
      })
      return
    }

    let cancelled = false

    void window.vaultApi
      .listTemplates()
      .then((templates) => {
        if (!cancelled) {
          setNoteTemplates(templates)
        }
      })
      .catch((templatesError: unknown) => {
        if (!cancelled) {
          setNoteTemplates([])
          onError(formatError(templatesError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, onError, vault])

  useEffect(() => {
    if (!selectedTag) {
      queueMicrotask(() => {
        setTaggedNotes([])
        setIsLoadingTaggedNotes(false)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoadingTaggedNotes(true)
      }
    })

    void window.indexApi
      .notesByTag(selectedTag)
      .then((notes) => {
        if (!cancelled) {
          setTaggedNotes(notes)
        }
      })
      .catch((tagNotesError: unknown) => {
        if (!cancelled) {
          setTaggedNotes([])
          onError(formatError(tagNotesError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTaggedNotes(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, onError, selectedTag])

  const backlinks = backlinksState.relativePath === selectedPath ? backlinksState.backlinks : []
  const outlineHeadings = outlineState.relativePath === selectedPath ? outlineState.headings : []

  return {
    indexNotes,
    noteTemplates,
    backlinks,
    outlineHeadings,
    tags,
    selectedTag,
    taggedNotes,
    isLoadingTaggedNotes,
    indexRevision,
    setIndexNotes,
    setSelectedTag,
    bumpIndexRevision
  }
}

export type NoteIndexController = ReturnType<typeof useNoteIndex>
