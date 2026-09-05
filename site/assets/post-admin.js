import { deletePost, getAllPosts, savePost, uploadPostMedia } from './post-store.js';
import { esc, formatDate, showToast } from './layout.js';

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 190);
const icon = (label, command, value = '') => `<button type="button" data-command="${command}" data-value="${value}" title="${label}">${label}</button>`;
const dimensions = (file) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { URL.revokeObjectURL(image.src); resolve([image.naturalWidth, image.naturalHeight]); }; image.onerror = reject; image.src = URL.createObjectURL(file); });
async function requireRatio(file, expected, label) { if (!file) return; const [width,height] = await dimensions(file); if (Math.abs(width / height - expected) > .035) throw new Error(`${label} must use a ${expected > 1 ? '16:9' : '1:1'} aspect ratio.`); if (label === 'Thumbnail' && (width !== 2160 || height !== 2160)) throw new Error('Thumbnail must be exactly 2160×2160 pixels.'); }

export async function renderPostAdmin(root, nav) {
  root.innerHTML = `${nav()}<main class="container wide admin-page post-studio"><div class="admin-intro"><div><span class="eyebrow">Supabase publishing</span><h1>Post studio.</h1><p>Build rich posts, manage feature placement, and upload responsive artwork.</p></div></div><div data-post-studio-content><div class="panel">Loading posts…</div></div></main>`;
  await render(root);
}

async function render(root, editing = null) {
  const posts = await getAllPosts();
  const host = root.querySelector('[data-post-studio-content]');
  host.innerHTML = `<section class="post-editor-shell">
    <form data-post-form>
      <input type="hidden" name="id" value="${esc(editing?.id || '')}">
      <div class="post-editor-top"><input class="post-title-input" name="title" value="${esc(editing?.title || '')}" placeholder="Give your post a title…" maxlength="180" required><div class="post-publish-actions"><button class="button ghost" type="submit" data-save-status="draft">Save draft</button><button class="button primary" type="submit" data-save-status="published">Publish</button></div></div>
      <div class="post-toolbar" role="toolbar" aria-label="Post formatting">${icon('↶','undo')}${icon('↷','redo')}${icon('H2','formatBlock','H2')}${icon('H3','formatBlock','H3')}${icon('¶','formatBlock','P')}${icon('B','bold')}${icon('I','italic')}${icon('U','underline')}${icon('S','strikeThrough')}${icon('• List','insertUnorderedList')}${icon('1. List','insertOrderedList')}${icon('❝','formatBlock','BLOCKQUOTE')}${icon('Link','createLink')}${icon('Image','insertImage')}<button type="button" data-clear-format>Clear</button></div>
      <div class="post-writing-area" data-editor contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Start writing your post…">${editing?.content_html || ''}</div>
      <div class="post-meta-grid"><label>Slug<input name="slug" value="${esc(editing?.slug || '')}" placeholder="generated-from-title"></label><label>Excerpt<textarea name="excerpt" maxlength="500" required placeholder="A short summary for cards and search.">${esc(editing?.excerpt || '')}</textarea></label></div>
      <div class="post-art-grid"><label class="art-upload"><span>Full Thumb <b>16:9</b></span><small>Hero, lead card, and full-width artwork</small><input type="file" name="full_thumb" accept="image/*" ${editing ? '' : 'required'}><img data-full-preview src="${esc(editing?.full_thumb_url || '/assets/images/post-fallback-full.webp')}" alt=""></label><label class="art-upload poster"><span>Thumbnail <b>1:1 · 2160×2160</b></span><small>Square artwork for the header drawer and compact cards</small><input type="file" name="poster" accept="image/*" ${editing ? '' : 'required'}><img data-poster-preview src="${esc(editing?.poster_url || '/assets/images/post-fallback-poster.webp')}" alt=""></label></div>
      <label class="gallery-upload">Additional inline images<input type="file" name="gallery" accept="image/*" multiple><small>Choose any number of supporting images. They are uploaded to the post media library.</small></label>
      <div class="post-feature-row"><label><input type="checkbox" name="is_hero" ${editing?.is_hero ? 'checked' : ''}> Feature in hero <small>Maximum 3; the oldest selection is removed automatically.</small></label><label><input type="checkbox" name="is_pinned" ${editing?.is_pinned ? 'checked' : ''}> Pin post <small>Maximum 6; the oldest selection is removed automatically.</small></label></div>
    </form>
  </section>
  <section class="published-posts"><div class="panel-heading"><div><span class="eyebrow">Library</span><h2>All posts</h2></div><span>${posts.length} total</span></div><div class="post-manage-grid">${posts.map((post) => `<article><img src="${esc(post.poster_url)}" alt=""><div><span class="status-pill ${post.status === 'published' ? 'good' : 'unknown'}">${esc(post.status)}</span><h3>${esc(post.title)}</h3><small>${formatDate(post.updated_at)}</small><p>${post.is_hero ? 'Hero · ' : ''}${post.is_pinned ? 'Pinned' : ''}</p><div><button class="button small ghost" type="button" data-edit-post="${post.id}">Edit</button><button class="button small danger" type="button" data-delete-post="${post.id}">Delete</button></div></div></article>`).join('') || '<div class="empty-card">No Supabase posts yet.</div>'}</div></section>`;
  bind(root, posts);
}

function bind(root, posts) {
  const form = root.querySelector('[data-post-form]');
  const editor = root.querySelector('[data-editor]');
  let submitStatus = 'draft';
  form.querySelectorAll('[data-save-status]').forEach((button) => button.addEventListener('click', () => { submitStatus = button.dataset.saveStatus; }));
  form.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => {
    let value = button.dataset.value || null;
    if (button.dataset.command === 'createLink') value = prompt('Paste the link URL:') || '';
    if (button.dataset.command === 'insertImage') value = prompt('Paste the image URL:') || '';
    if (value !== '') document.execCommand(button.dataset.command, false, value);
    editor.focus();
  }));
  form.querySelector('[data-clear-format]').onclick = () => document.execCommand('removeFormat');
  const preview = (input, selector) => input.addEventListener('change', () => { const file = input.files[0]; if (file) root.querySelector(selector).src = URL.createObjectURL(file); });
  preview(form.elements.full_thumb, '[data-full-preview]'); preview(form.elements.poster, '[data-poster-preview]');
  if (!form.elements.slug.value) form.elements.title.addEventListener('input', () => { form.elements.slug.value = slugify(form.elements.title.value); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector(`[data-save-status="${submitStatus}"]`); button.disabled = true;
    try {
      const existing = posts.find((post) => post.id === form.elements.id.value);
      const folder = slugify(form.elements.slug.value || form.elements.title.value) || crypto.randomUUID();
      await requireRatio(form.elements.full_thumb.files[0], 16 / 9, 'Full Thumb');
      await requireRatio(form.elements.poster.files[0], 1, 'Thumbnail');
      const full = form.elements.full_thumb.files[0] ? await uploadPostMedia(form.elements.full_thumb.files[0], `${folder}/full`) : { path: existing?.full_thumb_path, url: existing?.full_thumb_url };
      const poster = form.elements.poster.files[0] ? await uploadPostMedia(form.elements.poster.files[0], `${folder}/poster`) : { path: existing?.poster_path, url: existing?.poster_url };
      const gallery = [...(existing?.gallery || [])];
      const added = [];
      for (const file of form.elements.gallery.files) { const uploaded = await uploadPostMedia(file, `${folder}/gallery`); gallery.push(uploaded); added.push(uploaded); }
      const now = new Date().toISOString();
      const galleryHtml = added.map((item) => `<figure><img src="${item.url}" alt=""><figcaption></figcaption></figure>`).join('');
      await savePost({ id: existing?.id, slug: folder, title: form.elements.title.value.trim(), excerpt: form.elements.excerpt.value.trim(), content_html: editor.innerHTML.trim() + galleryHtml, full_thumb_url: full.url, full_thumb_path: full.path, poster_url: poster.url, poster_path: poster.path, gallery, status: submitStatus, is_hero: form.elements.is_hero.checked, is_pinned: form.elements.is_pinned.checked, published_at: submitStatus === 'published' ? existing?.published_at || now : existing?.published_at || null });
      showToast(submitStatus === 'published' ? 'Post published.' : 'Draft saved.'); await render(root);
    } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
  });
  root.querySelectorAll('[data-edit-post]').forEach((button) => button.onclick = () => render(root, posts.find((post) => post.id === button.dataset.editPost)));
  root.querySelectorAll('[data-delete-post]').forEach((button) => button.onclick = async () => { if (!confirm('Delete this post permanently?')) return; try { await deletePost(button.dataset.deletePost); showToast('Post deleted.'); await render(root); } catch (error) { showToast(error.message, 'error'); } });
}
