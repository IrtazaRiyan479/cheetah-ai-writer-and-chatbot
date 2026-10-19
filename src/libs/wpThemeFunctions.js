const AI_META_SNIPPET = `add_action( 'rest_insert_post', 'save_ai_meta_tags_via_rest', 10, 3 );
function save_ai_meta_tags_via_rest( $post, $request, $creating ) {
    $meta = $request->get_param( 'meta' );

    if ( isset( $meta ) && is_array( $meta ) ) {
        if ( isset( $meta['meta_title'] ) && !empty( $meta['meta_title'] ) ) {
            update_post_meta( $post->ID, 'ai_meta_title', sanitize_text_field( $meta['meta_title'] ) );
        }
        if ( isset( $meta['meta_description'] ) && !empty( $meta['meta_description'] ) ) {
            update_post_meta( $post->ID, 'ai_meta_description', sanitize_text_field( $meta['meta_description'] ) );
        }
    }
}
add_action( 'wp_head', 'inject_ai_meta_tags' );
function inject_ai_meta_tags() {
    if ( is_single() || is_page() ) {
        global $post;
        $ai_title = get_post_meta( $post->ID, 'ai_meta_title', true );
        $ai_desc = get_post_meta( $post->ID, 'ai_meta_description', true );
        if ( !empty( $ai_title ) ) {
            echo '<title>' . esc_html( $ai_title ) . '</title>' . "\\n";
        }
        if ( !empty( $ai_desc ) ) {
            echo '<meta name="description" content="' . esc_attr( $ai_desc ) . '">' . "\\n";
        }
    }
}`

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function cleanSiteUrl(url) {
  let clean = String(url || '').trim()

  if (!clean) throw new Error('WordPress site URL is missing.')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`

  return clean.replace(/\/+$/, '').replace(/\/wp-json(?:\/wp\/v2)?$/i, '')
}

function inputValue(html, name) {
  const tag = html.match(new RegExp(`<input[^>]*name=["']${name}["'][^>]*>`, 'i'))

  if (!tag) return ''

  const value = tag[0].match(/value=["']([^"']*)["']/i)

  return value ? decodeHtml(value[1]) : ''
}

function textareaValue(html) {
  const match = html.match(/<textarea[^>]*id=["']newcontent["'][^>]*>([\s\S]*?)<\/textarea>/i)

  return match ? decodeHtml(match[1]) : null
}

function hasMetaSnippet(content) {
  return (
    content.includes('function save_ai_meta_tags_via_rest') && content.includes('function inject_ai_meta_tags')
  )
}

function appendSnippet(content) {
  const trimmed = String(content || '').replace(/\s+$/, '')

  if (trimmed.endsWith('?>')) {
    return `${trimmed.slice(0, -2).replace(/\s+$/, '')}\n\n${AI_META_SNIPPET}\n`
  }

  return `${trimmed}\n\n${AI_META_SNIPPET}\n`
}

async function wpAdminFetch(url, options) {
  return fetch(url, {
    ...options,
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  })
}

export async function ensureAiMetaFunctions({ siteUrl, username, password }) {
  try {
    const base = cleanSiteUrl(siteUrl)
    const appPassword = String(password || '').replace(/\s+/g, '')
    const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64')
    const headers = {
      Authorization: `Basic ${credentials}`,
      'User-Agent': 'AffiGenie'
    }
    const editorUrl = `${base}/wp-admin/theme-editor.php?file=functions.php`
    const editorRes = await wpAdminFetch(editorUrl, { headers })
    const editorHtml = await editorRes.text()
    const finalUrl = editorRes.url || ''

    if (finalUrl.includes('wp-login.php') || editorHtml.includes('id="loginform"')) {
      return {
        ok: false,
        status: 'failed',
        error: 'Could not open the theme editor. Use an Administrator application password.'
      }
    }

    const current = textareaValue(editorHtml)
    const nonce = inputValue(editorHtml, 'nonce')
    const theme = inputValue(editorHtml, 'theme')
    const file = inputValue(editorHtml, 'file') || 'functions.php'

    if (current == null || !nonce || !theme) {
      if (/file editing (has been |is )?disabled|theme and plugin editors/i.test(editorHtml)) {
        return {
          ok: false,
          status: 'failed',
          error: 'Theme file editor is disabled on this WordPress site.'
        }
      }

      return {
        ok: false,
        status: 'failed',
        error: 'Could not read functions.php from the WordPress theme editor.'
      }
    }

    if (hasMetaSnippet(current)) {
      return { ok: true, status: 'exists' }
    }

    const body = new URLSearchParams()

    body.set('nonce', nonce)
    body.set('_wpnonce', nonce)
    body.set('newcontent', appendSnippet(current))
    body.set('action', 'update')
    body.set('file', file)
    body.set('theme', theme)
    body.set('submit', 'Update File')

    const saveRes = await wpAdminFetch(editorUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: editorUrl
      },
      body
    })
    const saveHtml = await saveRes.text()
    const saveUrl = saveRes.url || ''

    if (saveUrl.includes('a=1') || /File edited successfully/i.test(saveHtml)) {
      return { ok: true, status: 'added' }
    }

    const message = saveHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const clipped = message.slice(0, 280)

    return {
      ok: false,
      status: 'failed',
      error: clipped || 'WordPress did not update functions.php.'
    }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      error: error?.message || 'Could not update functions.php.'
    }
  }
}
