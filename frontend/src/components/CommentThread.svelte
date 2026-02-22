<script>
  import { createEventDispatcher } from 'svelte'
  import { replyAnnotation, resolveAnnotation, deleteAnnotation } from '../lib/api.js'

  export let annotation

  const dispatch = createEventDispatcher()

  let replyText = ''
  let replyAuthor = 'bruce'
  let showReplyForm = false
  let submitting = false

  function fmtDate(iso) {
    if (!iso) return ''
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  function avatarColor(author) {
    const map = { shankar: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
                  bruce:   'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' }
    return map[author] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }

  async function submitReply() {
    if (!replyText.trim()) return
    submitting = true
    try {
      await replyAnnotation(annotation.id, { comment: replyText.trim(), author: replyAuthor })
      replyText = ''
      showReplyForm = false
      dispatch('updated')
    } catch (e) {
      alert('Failed to reply: ' + e.message)
    } finally {
      submitting = false
    }
  }

  async function resolve() {
    try {
      await resolveAnnotation(annotation.id, 'bruce')
      dispatch('updated')
    } catch (e) {
      alert('Failed to resolve: ' + e.message)
    }
  }

  async function remove() {
    if (!confirm('Delete this comment and all replies?')) return
    try {
      await deleteAnnotation(annotation.id)
      dispatch('updated')
    } catch (e) {
      alert('Failed to delete: ' + e.message)
    }
  }

  $: isResolved = annotation.resolved
  $: replies = annotation.replies || []
</script>

<article
  class="px-4 py-3 border-b border-gray-100 dark:border-gray-800/70 transition-opacity"
  class:opacity-50={isResolved}
>
  <!-- ── Root comment ─────────────────────────────────────────────────── -->
  <div class="flex gap-3 items-start">
    <!-- Avatar -->
    <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                text-xs font-bold mt-0.5 {avatarColor(annotation.author)}"
         aria-hidden="true">
      {(annotation.author || '?')[0].toUpperCase()}
    </div>

    <div class="flex-1 min-w-0">
      <!-- Meta row -->
      <div class="flex items-center gap-2 flex-wrap mb-1">
        <span class="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize">
          {annotation.author}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500">{fmtDate(annotation.created_at)}</span>
        {#if isResolved}
          <span class="text-xs font-medium text-green-600 dark:text-green-400">✓ Resolved</span>
          {#if annotation.resolved_by}
            <span class="text-xs text-gray-400">by {annotation.resolved_by}</span>
          {/if}
        {/if}
      </div>

      <!-- Selected text quote -->
      {#if annotation.selected_text}
        <blockquote class="text-xs italic text-gray-500 dark:text-gray-400
                           border-l-2 border-yellow-400 pl-2 mb-2 line-clamp-3">
          "{annotation.selected_text}"
        </blockquote>
      {/if}

      <!-- Comment body -->
      <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
        {annotation.comment}
      </p>

      <!-- Action row (touch-friendly: use larger tap area via padding) -->
      {#if !isResolved}
        <div class="flex gap-1 mt-2 -ml-2">
          <button
            on:click={() => showReplyForm = !showReplyForm}
            class="px-2 py-1.5 text-xs text-blue-500 hover:text-blue-700
                   dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            style="min-height:36px"
          >Reply</button>
          <button
            on:click={resolve}
            class="px-2 py-1.5 text-xs text-green-600 hover:text-green-800
                   dark:hover:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
            style="min-height:36px"
          >Resolve ✓</button>
          <button
            on:click={remove}
            class="px-2 py-1.5 text-xs text-red-400 hover:text-red-600
                   dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            style="min-height:36px"
          >Delete</button>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Replies ───────────────────────────────────────────────────────── -->
  {#if replies.length > 0}
    <div class="ml-10 mt-3 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
      {#each replies as reply (reply.id)}
        <div class="flex gap-2 items-start">
          <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                      text-xs font-bold {avatarColor(reply.author)}"
               aria-hidden="true">
            {(reply.author || '?')[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize">{reply.author}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">{fmtDate(reply.created_at)}</span>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {reply.comment}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Reply compose ─────────────────────────────────────────────────── -->
  {#if showReplyForm}
    <div class="ml-10 mt-3 space-y-2">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-500">As:</label>
        <select
          bind:value={replyAuthor}
          class="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700
                 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          style="min-height:36px"
        >
          <option value="bruce">Bruce</option>
          <option value="shankar">Shankar</option>
        </select>
      </div>
      <textarea
        bind:value={replyText}
        placeholder="Reply…"
        rows="3"
        class="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
               bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none
               focus:outline-none focus:ring-2 focus:ring-blue-500"
        style="min-height:72px"
      ></textarea>
      <div class="flex gap-2">
        <button
          on:click={submitReply}
          disabled={submitting || !replyText.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                 text-white text-xs font-medium rounded-xl transition-colors"
          style="min-height:44px"
        >{submitting ? '…' : 'Post reply'}</button>
        <button
          on:click={() => { showReplyForm = false; replyText = '' }}
          class="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300
                 text-xs rounded-xl border border-gray-200 dark:border-gray-700"
          style="min-height:44px"
        >Cancel</button>
      </div>
    </div>
  {/if}
</article>
