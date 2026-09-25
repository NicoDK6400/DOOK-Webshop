let products=window.frameCatalog.slice().sort(modelSort);let detailModel=null,variantIndex=0,viewIndex=0,detailQty=1,lensIndex=-1,returnPage='collection',contactDraft='';let bag={},sun=false,tab='frames',lastFocus=null;
const app=document.querySelector('#app');
const socialIcon={instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>',linkedin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="7.5" cy="7" r=".9" fill="currentColor" stroke="none"/><line x1="7.5" y1="10" x2="7.5" y2="16.5"/><path d="M11.5 16.5v-4c0-1.4.9-2.4 2.2-2.4 1.3 0 2 .9 2 2.4v4"/><line x1="11.5" y1="10" x2="11.5" y2="16.5"/></svg>',facebook:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M14 8.6h-1.3c-1 0-1.3.5-1.3 1.4v1.6h2.4l-.3 2.2h-2.1V19"/></svg>'};
const socialLabel={instagram:'Instagram',linkedin:'LinkedIn',facebook:'Facebook'};
const footerSocial=()=>{const keys=['instagram','linkedin','facebook'].filter(k=>aboutContent[k]);return keys.length?`<div class="footer-social">${keys.map(k=>`<a href="${escapeHTML(aboutContent[k])}" target="_blank" rel="noopener noreferrer" aria-label="${t('footer.socialAria',{platform:socialLabel[k]})}">${socialIcon[k]}</a>`).join('')}</div>`:''};
const footer=()=>`<footer class="footer"><span>© ${new Date().getFullYear()} DOOK Denmark</span><div class="footer-links"><a href="#contact">${t('footer.contact')}</a><a href="#privacy">${t('footer.privacy')}</a><a href="#cookies">${t('footer.cookies')}</a></div>${footerSocial()}</footer>`;
const productCards=(items=products)=>`<div class="products">${items.map(p=>{const v=p.variants[0];const second=v.images[1];return `<button class="product" data-product="${p.id}" aria-label="${t('common.exploreAria',{id:p.id})}"><div class="product-img"><img src="${v.images[0].src}" alt="DOOK ${p.id}, ${v.name}" loading="lazy">${second?`<img class="product-alternate" src="${second.src}" alt="" loading="lazy">`:''}<span class="plus" aria-hidden="true"></span></div><div class="product-info"><div><strong>${p.id}</strong><small>${p.variants.length} ${p.variants.length===1?t('common.colour'):t('common.colours')} · ${t('common.acetate')}</small>${priceSummary(p.id)}</div><div class="card-swatches">${p.variants.map(c=>`<span class="swatch" style="background:${c.hex}" title="${c.name}"></span>`).join('')}</div></div></button>`}).join('')}</div>`;
let slideshowImages=[];
async function loadSlideshow(){try{slideshowImages=(await api('/api/slideshow')).images}catch{slideshowImages=[]}if(location.hash==='#home'||location.hash==='')render()}
function slideshowMarkup(){
 if(!slideshowImages.length)return `<p class="empty">${t('home.someEmpty')}</p>`;
 const imgs=slideshowImages.map(im=>`<img src="${escapeHTML(im.src)}" alt="${escapeHTML(im.alt||'')}" loading="lazy">`).join('');
 return `<div class="slideshow-viewport" id="home-slideshow"><div class="slideshow-track">${imgs}${imgs}</div></div>`;
}
let slideshowRAF=null,slideshowPaused=false,slideshowDrag=null;
function initSlideshow(){
 const el=document.querySelector('#home-slideshow');
 if(!el||el.dataset.bound)return;el.dataset.bound='1';
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let carry=0; // scrollLeft only takes whole pixels, so accumulate the slow fractional speed here.
 function step(){
  if(!document.body.contains(el)){if(slideshowRAF)cancelAnimationFrame(slideshowRAF);slideshowRAF=null;return}
  if(!slideshowPaused&&!reduceMotion){
   carry+=0.4;
   if(carry>=1){const whole=Math.floor(carry);el.scrollLeft+=whole;carry-=whole}
   const half=el.scrollWidth/2;if(half&&el.scrollLeft>=half)el.scrollLeft-=half;
  }
  slideshowRAF=requestAnimationFrame(step);
 }
 slideshowRAF=requestAnimationFrame(step);
 el.addEventListener('mouseenter',()=>slideshowPaused=true);
 el.addEventListener('mouseleave',()=>{slideshowPaused=false;slideshowDrag=null;el.classList.remove('dragging')});
 el.addEventListener('mousedown',e=>{slideshowDrag={x:e.clientX,scroll:el.scrollLeft};el.classList.add('dragging')});
 el.addEventListener('touchstart',()=>slideshowPaused=true,{passive:true});
 el.addEventListener('touchend',()=>slideshowPaused=false,{passive:true});
 window.addEventListener('mousemove',e=>{if(!slideshowDrag)return;el.scrollLeft=slideshowDrag.scroll-(e.clientX-slideshowDrag.x)});
 window.addEventListener('mouseup',()=>{slideshowDrag=null;el.classList.remove('dragging')});
}
function setHeroLens(value){sun=value;const stage=document.querySelector('.dook-stage');if(!stage)return;stage.classList.toggle('is-attached',sun);stage.setAttribute('aria-label',sun?t('home.stageAriaSun'):t('home.stageAriaClear'));document.querySelectorAll('[data-lens]').forEach(b=>{const active=b.dataset.lens===(sun?'sun':'clear');b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))})}
let heroAutoplayTimer=null;
function stopHeroAutoplay(){if(heroAutoplayTimer){clearInterval(heroAutoplayTimer);heroAutoplayTimer=null}}
function initHeroAutoplay(){
 stopHeroAutoplay();
 const stage=document.querySelector('.dook-stage');
 if(!stage||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 heroAutoplayTimer=setInterval(()=>{if(!document.body.contains(stage)){stopHeroAutoplay();return}setHeroLens(!sun)},3200);
}
function home(){return `<section class="hero"><span class="eyebrow">${t('home.eyebrow')}</span><div class="hero-intro"><h1>${t('home.h1Line1')}<br><em>${t('home.h1Line2')}</em></h1></div><div class="hero-visual"><div class="dook-stage ${sun?'is-attached':''}" role="img" aria-label="${sun?t('home.stageAriaSun'):t('home.stageAriaClear')}"><img class="dook-base" src="/assets/a001-frame-full.png" alt="" fetchpriority="high"><div class="dook-layer dook-left" aria-hidden="true"><img src="/assets/dook-l.png" alt=""></div><div class="dook-layer dook-right" aria-hidden="true"><img src="/assets/dook-r.png" alt=""></div></div></div><div class="lens-switch"><button class="${!sun?'selected':''}" data-lens="clear" aria-pressed="${!sun}">${t('home.everyday')}</button><button class="${sun?'selected':''}" data-lens="sun" aria-pressed="${sun}">${t('home.withDook')} <span>◐</span></button></div><div class="hero-bottom"><div class="hero-caption"><strong>A001</strong></div></div></section><section class="section home-products"><div class="section-title"><div><h2>${t('home.someHeading')}</h2></div></div>${slideshowMarkup()}</section>${footer()}`}
function legacyCollection(){return `<section class="page-head"><span class="eyebrow">THOUGHTFULLY DESIGNED. UNIQUELY YOU.</span><h1>Find your perspective.</h1><p>Shapes with character. Details with purpose.<br>Discover your frame — then make it your own.</p></section><section class="section collection-section"><div class="tabs" role="tablist" aria-label="Collection type"><button role="tab" aria-selected="${tab==='frames'}" class="${tab==='frames'?'selected':''}" data-tab="frames">Frames</button><button role="tab" aria-selected="${tab==='dooks'}" class="${tab==='dooks'?'selected':''}" data-tab="dooks">DOOKs · Magnetic click-ons</button></div>${tab==='frames'?productCards():`<div class="dook-collection-intro"><h2>One frame. Ten perspectives.</h2><p>Choose A001 or AN001 to explore the DOOK lens colours on your frame.</p></div>${productCards(products.filter(p=>['A001','AN001'].includes(p.id)))}<p class="note">Illustrative colour previews. Our team will confirm the matching model, size and availability.</p>`}</section>`+footer()}
function legacyAbout(){return `<section class="page-head"><span class="eyebrow">A DIFFERENT WAY OF LOOKING AT THINGS</span><h1>Considered design.<br>Everyday freedom.</h1></section><section class="section about-layout"><div class="about-image"><img src="/assets/hero.webp" alt="The detail of a DOOK Havana frame"></div><div><span class="eyebrow">FROM DENMARK, WITH PERSPECTIVE</span><h2>Small details.<br>Real difference.</h2><p>At DOOK, we believe fundamental research and well-designed products lead to superior long-term performance.</p><p>Our approach is simple: eyewear with character, considered details and a magnetic click-on system that gives one frame more possibilities.</p><a class="text-link" href="#collection">Discover the collection </a></div></section><section class="manifesto"><div><span class="eyebrow">FOR OPTICAL PROFESSIONALS</span><h2>A shared<br>point of view.</h2></div><div><p>Bring DOOK to your customers. Explore our frames and talk with us about the right collection for your practice.</p><a href="#partners" class="pill light">Become a DOOK partner </a></div></section>`+footer()}
function contact(){return `<section class="page-head"><h1>${t('contact.h1')}</h1></section><section class="section contact-grid"><div class="contact-details"><div><small>${t('contact.writeLabel')}</small><a href="mailto:info@dook.dk">info@dook.dk </a></div><div><small>${t('contact.callLabel')}</small><a href="tel:+4540901919">+45 40 90 19 19 </a></div><div><small>${t('contact.findLabel')}</small><address>Tøndervej 3<br>DK-6200 Aabenraa<br>${t('contact.country')}</address></div></div><form class="contact-form"><div class="form-row"><label>${t('contact.firstName')}<input name="first" autocomplete="given-name" required placeholder="${t('contact.firstNamePh')}"></label><label>${t('contact.lastName')}<input name="last" autocomplete="family-name" required placeholder="${t('contact.lastNamePh')}"></label></div><label>${t('contact.emailLabel')}<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>${t('contact.messageLabel')}<textarea name="message" required placeholder="${t('contact.messagePh')}"></textarea></label><button class="pill" type="submit">${t('contact.composeEmail')} <span></span></button><p class="note">${t('contact.note')}</p></form></section>`+footer()}
function partnerCollection(){const count=Object.values(bag).reduce((a,b)=>a+b,0);return `<section class="page-head"><span class="eyebrow">${t('partnerCollection.eyebrow')}</span><h1>${t('partnerCollection.h1Line1')}<br>${t('partnerCollection.h1Line2')}</h1><p>${t('partnerCollection.intro')}</p></section><div class="partner-banner"><div><h2>${t('partnerCollection.bannerH2')}</h2><p>${t('partnerCollection.bannerCopy')}</p></div><a href="#contact" class="pill outline">${t('common.contactDook')} </a></div><section class="section"><div class="section-title"><h2>${t('partnerCollection.exploreFrames')}</h2><span class="note">${t('partnerCollection.frameCount',{n:products.length})}</span></div>${productCards()}<p class="note">${t('partnerCollection.showroomNote')}</p></section><section class="section" style="padding-top:0"><div class="section-title"><h2>${t('common.yourSelection')}.</h2><span>${count} ${count===1?t('common.frame'):t('common.frames')}</span></div>${count?Object.entries(bag).map(([id,qty])=>`<div class="order-list"><span>${id} <small> · ${t('common.acetateFrame')}</small></span><div class="quantity"><button data-qty="${id}" data-change="-1" aria-label="${t('partnerCollection.removeOne',{id})}">−</button><span>${qty}</span><button data-qty="${id}" data-change="1" aria-label="${t('partnerCollection.addOne',{id})}">+</button></div></div>`).join('')+`<button class="pill" style="margin-top:25px" id="send-enquiry">${t('partnerCollection.composeEnquiry')} </button><p class="note">${t('partnerCollection.composeNote')}</p>`:`<p class="empty">${t('partnerCollection.emptyState')}</p>`}</section>`+footer()}
function render(){queueMicrotask(()=>{refreshPrices();fillAdmin();ensureManagement();initSlideshow();initHeroAutoplay();paintDookSwatches()});if(location.hash.startsWith('#model/')){renderDetail();return;}let page=location.hash.slice(1)||'home';if(page.startsWith('admin-product/'))page='admin-product';if(!['home','collection','about','contact','partners','login','signup','forgot-password','admin','selection','admin-content','admin-products','admin-product','admin-categories','admin-orders','admin-stock','privacy','cookies'].includes(page))page='home';app.innerHTML=({home,collection:categorizedCollection,about:aboutPage,contact,partners:partnerShop,login:partnerShop,signup:partnerShop,"forgot-password":partnerShop,admin:adminHub,"admin-content":adminPage,"admin-products":manageProducts,"admin-product":manageProductEditor,"admin-categories":manageCategories,"admin-orders":managedOrders,"admin-stock":stockAdmin,selection:selectionPage,privacy:privacyPage,cookies:cookiesPage})[page]();document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelector('.sidebar').classList.remove('open');document.querySelector('.mobile-toggle').setAttribute('aria-expanded','false');if(page==='contact'&&contactDraft)document.querySelector('textarea').value=contactDraft;document.title=`${translations.en['title.'+page]!==undefined?t('title.'+page):page[0].toUpperCase()+page.slice(1)} — DOOK Denmark`;}
window.addEventListener('hashchange',async()=>{closeModal();if(await handleAuthLink())return;render();window.scrollTo(0,0)});
document.querySelector('.mobile-toggle').onclick=e=>{const open=document.querySelector('.sidebar').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))};
function showProduct(id){returnPage=location.hash==='#partners'?'partners':'collection';detailModel=null;location.hash='model/'+id;}
// Every product page is built from the live catalogue, so all photos (and admin edits) show.
// Colours without their own photo fall back to the product's reference photo, labelled as such.
function detailProduct(id){
 const p=window.tradeCatalog.find(x=>x.id===id);if(!p)return null;
 const shown=photoColourIndex(p);
 return {...p,variants:p.variants.map((v,i)=>({...v,hex:colourPaint(v),images:v.images.length?v.images:p.referenceImage?[{src:p.referenceImage,paired:p.pairedImage||'',view:'front',label:i===shown?'Front view':t('shop.shownColour',{colour:p.referenceColour||''})}]:[]}))};
}

function closeModal(){document.querySelector('#modal').hidden=true;document.body.style.overflow='';lastFocus?.focus()}
document.querySelector('.close').onclick=closeModal;document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};document.addEventListener('keydown',e=>{if(document.querySelector('#modal').hidden)return;if(e.key==='Escape')closeModal();if(e.key==='Tab'){const list=[...document.querySelectorAll('#modal button,#modal a')];const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
document.addEventListener('click',e=>{const p=e.target.closest('[data-product]');if(p)showProduct(p.dataset.product);const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`).focus()}if(e.target.closest('[data-close]'))closeModal();const lens=e.target.closest('[data-lens]');if(lens){stopHeroAutoplay();setHeroLens(lens.dataset.lens==='sun')}const add=e.target.closest('[data-add]');if(add){bag[add.dataset.add]=(bag[add.dataset.add]||0)+1;closeModal();render();const toast=document.querySelector('.toast');toast.textContent=t('partnerCollection.addedToast',{id:add.dataset.add});toast.hidden=false;setTimeout(()=>toast.hidden=true,2500)}const q=e.target.closest('[data-qty]');if(q){bag[q.dataset.qty]+=Number(q.dataset.change);if(!bag[q.dataset.qty])delete bag[q.dataset.qty];const y=scrollY;render();scrollTo(0,y)}if(e.target.closest('#send-enquiry')){const body=t('partnerCollection.mailGreeting')+Object.entries(bag).map(([id,n])=>`${id}: ${n}`).join('\n')+t('partnerCollection.mailFooter');location.href='mailto:info@dook.dk?subject='+encodeURIComponent(t('partnerCollection.mailSubject'))+'&body='+encodeURIComponent(body)}});
document.addEventListener('submit',e=>{if(!e.target.matches('.contact-form'))return;e.preventDefault();const f=new FormData(e.target);location.href='mailto:info@dook.dk?subject='+encodeURIComponent(t('contact.mailSubjectPrefix')+f.get('first')+' '+f.get('last'))+'&body='+encodeURIComponent(f.get('message')+'\n\n'+f.get('first')+' '+f.get('last')+'\n'+f.get('email'))});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'stage_frame_enquiry',title:'Add frames to a DOOK enquiry',description:'Stage frame quantities in the visible partner enquiry. Does not send an email or place an order.',inputSchema:{type:'object',properties:{items:{type:'array',items:{type:'object',properties:{id:{type:'string',enum:products.map(p=>p.id)},quantity:{type:'integer',minimum:1,maximum:100}},required:['id','quantity'],additionalProperties:false},minItems:1,maxItems:6}},required:['items'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!Array.isArray(input.items)||!input.items.length||input.items.length>6||input.items.some(x=>!products.some(p=>p.id===x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>100))throw new Error('Provide valid frame IDs and quantities from 1 to 100.');for(const item of input.items)bag[item.id]=item.quantity;location.hash='partners';render();return {status:'staged',selection:{...bag},sent:false}}})).catch(()=>{})}catch{}}
function renderDetail(){queueMicrotask(refreshPrices);const id=location.hash.split('/')[1];if(!catalogueReady){app.innerHTML=catalogueLoading();return}const p=detailProduct(id);if(!p){location.hash='collection';return}if(detailModel!==id){detailModel=id;variantIndex=collectionChoices[id]?.colour??photoColour(p);viewIndex=0;detailQty=1;lensIndex=-1}if(!p.variants[variantIndex])variantIndex=0;const v=p.variants[variantIndex];if(viewIndex>=v.images.length)viewIndex=0;const im=v.images[viewIndex];document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page==='collection');if(a.dataset.page==='collection')a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelector('.sidebar').classList.remove('open');document.querySelector('.mobile-toggle').setAttribute('aria-expanded','false');document.title=`${id} · ${v.name} — DOOK Denmark`;app.innerHTML=`<div class="detail-breadcrumb"><a href="#${returnPage}">← ${returnPage==='partners'?t('common.viewPartnerCollection'):t('common.theCollection')}</a><span>${escapeHTML(window.liveCategories?.find(c=>c.id===p.category)?.name||p.category)} / ${id}</span></div><section class="product-detail"><div class="detail-gallery">${im?`<div class="gallery-stage"><span class="gallery-mark">DOOK / ${id}</span><button class="zoom-image" aria-label="${t('detail.enlargeProductAria',{id})}" data-zoom><span class="detail-photo"><img class="detail-main-image" src="${im.src}" alt="${id} in ${v.name}, ${im.label}"><span class="detail-dook-layer detail-dook-left" hidden aria-hidden="true"><img alt=""></span><span class="detail-dook-layer detail-dook-right" hidden aria-hidden="true"><img alt=""></span></span></button><span class="gallery-view">${im.label}</span><button class="zoom-trigger" data-zoom aria-label="${t('detail.enlargeAria')}">＋</button></div><div class="gallery-bottom"><div class="gallery-thumbs" aria-label="${t('detail.productViewsAria')}">${v.images.map((pic,i)=>`<button data-view="${i}" class="${i===viewIndex?'selected':''}" aria-pressed="${i===viewIndex}" aria-label="${t('detail.showAria',{label:pic.label})}"><img src="${pic.src}" alt="${pic.label}"></button>`).join('')}</div><span class="image-count">0${viewIndex+1} / 0${v.images.length}</span></div>`:`<div class="gallery-stage gallery-empty"><div class="model-specimen"><span>${escapeHTML(p.material)}</span><strong>${escapeHTML(p.id)}</strong><small>${t('shop.noPhotoYet')}</small></div></div>`}</div><div class="detail-info"><h1>${id}</h1><div class="detail-option"><div class="option-label"><span>${t('common.colourLabel')}</span><strong>${v.name}</strong></div><div class="colour-options" aria-label="${t('detail.chooseColourAria')}">${p.variants.map((c,i)=>`<button data-colour="${i}" style="--swatch:${c.hex}" class="${i===variantIndex?'selected':''}" aria-pressed="${i===variantIndex}" aria-label="${c.name}"><span></span></button>`).join('')}</div><span class="colour-code">${id} / ${v.code}</span></div><div class="lens-slot">${lensOptions(id,im?.src)}</div>${detailPriceHTML()}${id==='A012'?`<div class="detail-size"><span>${t('common.lensSize')}</span><span class="size-value">50 mm</span></div>`:''}${returnPage==='partners'?`<div class="detail-cta"><div class="detail-quantity"><button data-detail-qty="-1" aria-label="${t('detail.decreaseQty')}" ${detailQty===1?'disabled':''}>−</button><output>${detailQty}</output><button data-detail-qty="1" aria-label="${t('detail.increaseQty')}" ${detailQty===100?'disabled':''}>+</button></div><button class="pill" data-detail-add>${t('detail.addToEnquiry')} <span></span></button></div>`:''}<p class="detail-support">${returnPage==='partners'?t('detail.supportPartner'):t('detail.supportPublic')}</p><div class="detail-shop-slot"></div><div class="detail-facts"><span>${t('detail.designedInDenmark')}</span><span>${escapeHTML(p.material||'')}</span></div><details class="detail-accordion"><summary>${t('detail.accordionSummary')}<span>+</span></summary><p>${t('detail.accordionCopy')}</p>${returnPage==='partners'?`<button class="text-button" data-enquire>${t('detail.askMatchingDooks')} </button>`:''}</details></div></section><section class="section about-frame"><div class="section-title"><div><h2>${t('detail.aboutFrame')}</h2></div></div><p>${escapeHTML(p.description||t('detail.aboutFrameDefault'))}</p></section>`+footer();updateGalleryImage();for(const variant of p.variants)for(const photo of variant.images){const preload=new Image();preload.src=photo.src}}
// Update only the existing controls and image; the page, focus and scroll stay intact.
function updateDetail(){
 queueMicrotask(refreshPrices);
 const p=detailProduct(detailModel),v=p.variants[variantIndex],hasPhoto=v.images.length>0;
 // Switching between a colour with and without any photo changes the gallery's structure.
 if(hasPhoto!==!!document.querySelector('.detail-main-image'))return renderDetail();
 if(viewIndex>=v.images.length)viewIndex=0;
 document.title=`${p.id} · ${v.name} — DOOK Denmark`;
 document.querySelector('.option-label strong').textContent=v.name;
 document.querySelector('.colour-code').textContent=`${p.id} / ${v.code}`;
 document.querySelectorAll('[data-colour]').forEach(b=>{const selected=Number(b.dataset.colour)===variantIndex;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
 const slot=document.querySelector('.lens-slot'),tryOn=window.hasDookPreview(p.id,v.images[viewIndex]?.src);
 if(tryOn!==!!slot.firstElementChild){if(!tryOn)lensIndex=-1;slot.innerHTML=tryOn?lensOptions(p.id,v.images[viewIndex].src):''}
 if(!hasPhoto)return;
 const thumbs=document.querySelector('.gallery-thumbs');
 // Retain thumbnail buttons when the view count is unchanged, including keyboard focus.
 if(thumbs.children.length!==v.images.length)thumbs.innerHTML=v.images.map((pic,i)=>`<button data-view="${i}" aria-label="${t('detail.showAria',{label:pic.label})}"><img alt="${pic.label}"></button>`).join('');
 [...thumbs.children].forEach((b,i)=>{b.classList.toggle('selected',i===viewIndex);b.setAttribute('aria-pressed',String(i===viewIndex));b.setAttribute('aria-label',t('detail.showAria',{label:v.images[i].label}));b.firstElementChild.src=v.images[i].src;b.firstElementChild.alt=v.images[i].label});
 document.querySelector('.image-count').textContent=`0${viewIndex+1} / 0${v.images.length}`;
 document.querySelectorAll('[data-dook-colour]').forEach(b=>{const selected=Number(b.dataset.dookColour)===lensIndex;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
 const selected=document.querySelector('.selected-lens');if(selected)selected.textContent=lensIndex<0?t('detail.frameOnly'):window.dookLenses[lensIndex].name;
 updateGalleryImage();
}
let imageRequest=0;
const clipMotion=(index,attached)=>({opacity:attached?1:0,transform:attached?'translate(0,0) scale(1) rotate(0)':`translate(${index===0?'-':'+'}12%,-38%) scale(1.09) rotate(${index===0?'-':'+'}9deg)`,filter:attached?'drop-shadow(0 0 0 transparent)':'drop-shadow(0 16px 10px #383e4244)'});
async function moveClickOns(layers,attach){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 await Promise.all(layers.map((layer,index)=>layer.animate([clipMotion(index,!attach),clipMotion(index,attach)],{duration:attach?760:230,delay:attach?index*100:index*35,easing:attach?'cubic-bezier(.22,.8,.2,1)':'ease-in',fill:'both'}).finished.catch(()=>{})));
}
async function updateGalleryImage(){
 const request=++imageRequest,p=detailProduct(detailModel),v=p.variants[variantIndex],im=v.images[viewIndex];
 const target=document.querySelector('.detail-main-image'),stage=document.querySelector('.gallery-stage'),photo=document.querySelector('.detail-photo');
 if(!im||!target)return;
 const layers=[...photo.querySelectorAll('.detail-dook-layer')];
 layers.forEach(layer=>layer.getAnimations().forEach(animation=>animation.cancel()));
 const lens=lensIndex<0?null:window.dookLenses[lensIndex];
 const label=lens?`${lens.name} · DOOK preview`:im.label;
 const alt=`${p.id} in ${v.name}, ${label}`;
 const current=()=>request===imageRequest&&target.isConnected;
 stage.setAttribute('aria-busy','true');
 try{
  const scene=await window.makeDookScene(p.id,im.src,lens,im.paired);
  if(!current())return;
  if(layers.some(layer=>!layer.hidden))await moveClickOns(layers,false);
  if(!current())return;
  layers.forEach(layer=>{layer.hidden=true;layer.getAnimations().forEach(animation=>animation.cancel())});
  target.src=scene.base;target.dataset.zoomSrc=scene.composite;target.alt=alt;
  photo.style.aspectRatio=`${scene.width} / ${scene.height}`;
  document.querySelector('.gallery-view').textContent=label;
  document.querySelector('.preview-error')?.remove();
  if(scene.layers.length){
   await Promise.all(layers.map(async(layer,index)=>{layer.firstElementChild.src=scene.layers[index];await layer.firstElementChild.decode()}));
   if(!current())return;
   layers.forEach(layer=>layer.hidden=false);
   await moveClickOns(layers,true);
   if(!current())return;
   layers.forEach(layer=>layer.getAnimations().forEach(animation=>animation.cancel()));
  }
 }catch(error){
  if(!current())return;
  layers.forEach(layer=>{layer.hidden=true;layer.getAnimations().forEach(animation=>animation.cancel())});
  target.src=im.src;target.dataset.zoomSrc=im.src;target.alt=`${p.id} in ${v.name}`;
  document.querySelector('.gallery-view').textContent=im.label;
  if(!document.querySelector('.preview-error')){const note=document.createElement('p');note.className='preview-error';note.setAttribute('role','status');note.textContent=t('detail.previewError');stage.after(note)}
 }finally{if(current())stage.setAttribute('aria-busy','false')}
}
function lensDescription(){return lensIndex<0?'':` · DOOK: ${window.dookLenses[lensIndex].name}`}
function privacyPage(){return `<section class="page-head"><h1>${t('privacy.title')}</h1><p class="note">${t('privacy.disclaimer')}</p></section><section class="section legal-page"><h2>${t('privacy.controllerTitle')}</h2><p>DOOK Denmark<br>Tøndervej 3, DK-6200 Aabenraa<br><a href="mailto:info@dook.dk">info@dook.dk</a></p><h2>${t('privacy.whatTitle')}</h2><ul>${t('privacy.whatListHtml')}</ul><p>${t('privacy.noCollectionNote')}</p><h2>${t('privacy.sharedTitle')}</h2><p>${t('privacy.sharedBody')}</p><h2>${t('privacy.retentionTitle')}</h2><p>${t('privacy.retentionBody')}</p><h2>${t('privacy.rightsTitle')}</h2><p>${t('privacy.rightsBody')}</p><h2>${t('privacy.securityTitle')}</h2><p>${t('privacy.securityBody')}</p></section>`+footer()}
function cookiesPage(){return `<section class="page-head"><h1>${t('cookies.title')}</h1></section><section class="section legal-page"><p>${t('cookies.intro')}</p><div class="price-table-wrap"><table class="price-table"><thead><tr><th>${t('cookies.colName')}</th><th>${t('cookies.colPurpose')}</th><th>${t('cookies.colType')}</th><th>${t('cookies.colExpires')}</th></tr></thead><tbody><tr><td>dook_session</td><td>${t('cookies.necessaryPurpose')}</td><td>${t('cookies.necessaryType')}</td><td>${t('cookies.necessaryExpires')}</td></tr><tr><td>_ga, _ga_*, _gid</td><td>${t('cookies.analyticsPurpose')}</td><td>${t('cookies.analyticsType')}</td><td>${t('cookies.analyticsExpires')}</td></tr></tbody></table></div><p class="note">${t('cookies.note',{accept:t('cookie.accept'),decline:t('cookie.decline')})}</p><button class="pill outline" data-cookie-settings>${t('cookies.settingsButton')}</button></section>`+footer()}
const COOKIE_CONSENT_KEY='dook-cookie-consent';
function cookieConsent(){try{return localStorage.getItem(COOKIE_CONSENT_KEY)}catch{return null}}
function setCookieConsent(value){try{localStorage.setItem(COOKIE_CONSENT_KEY,value)}catch{}}
function loadAnalytics(){
 const gaId=document.body.dataset.gaId;
 if(!gaId||document.querySelector('#ga-script'))return;
 const s=document.createElement('script');s.id='ga-script';s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(gaId);document.head.appendChild(s);
 window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',gaId);
}
function initCookieBanner(){
 const consent=cookieConsent();
 if(consent==='accepted'){loadAnalytics();return}
 if(consent==='declined')return;
 document.querySelector('#cookie-banner').hidden=false;
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-cookie-accept]')){setCookieConsent('accepted');document.querySelector('#cookie-banner').hidden=true;loadAnalytics()}
 if(e.target.closest('[data-cookie-decline]')){setCookieConsent('declined');document.querySelector('#cookie-banner').hidden=true}
 if(e.target.closest('[data-cookie-settings]')){try{localStorage.removeItem(COOKIE_CONSENT_KEY)}catch{}document.querySelector('#cookie-banner').hidden=false}
});
document.addEventListener('click',e=>{
 const c=e.target.closest('[data-colour]');if(c){variantIndex=Number(c.dataset.colour);updateDetail()}
 const view=e.target.closest('[data-view]');if(view){viewIndex=Number(view.dataset.view);updateDetail()}
 const lens=e.target.closest('[data-dook-colour]');if(lens){lensIndex=Number(lens.dataset.dookColour);updateDetail()}
 const q=e.target.closest('[data-detail-qty]');if(q){detailQty=Math.max(1,Math.min(100,detailQty+Number(q.dataset.detailQty)));document.querySelector('.detail-quantity output').textContent=detailQty;document.querySelector('[data-detail-qty="-1"]').disabled=detailQty===1;document.querySelector('[data-detail-qty="1"]').disabled=detailQty===100}
 if(e.target.closest('[data-enquire]')){const p=detailProduct(detailModel),v=p.variants[variantIndex];contactDraft=t('detail.enquireDraft',{id:p.id,name:v.name,code:v.code,sizeNote:p.id==='A012'?t('detail.a012SizeNote'):'',lensDesc:lensDescription()});location.hash='contact'}
 if(e.target.closest('[data-detail-add]')){const p=detailProduct(detailModel),v=p.variants[variantIndex];const key=`${p.id} · ${v.code} · ${v.name}${p.id==='A012'?' · 50 mm':''}${lensDescription()}`;bag[key]=(bag[key]||0)+detailQty;const toast=document.querySelector('.toast');toast.innerHTML=`${t('detail.addedToast',{qty:detailQty,id:p.id})} <a href="#partners" style="text-decoration:underline">${t('common.viewEnquiry')} </a>`;toast.hidden=false;setTimeout(()=>toast.hidden=true,4500)}
 if(e.target.closest('[data-zoom]')){const p=detailProduct(detailModel),v=p.variants[variantIndex],shown=document.querySelector('.detail-main-image');lastFocus=document.activeElement;document.querySelector('#modal-content').innerHTML=`<span class="eyebrow" id="modal-title">${p.id} · ${v.name}</span><div class="enlarged-product"><img src="${shown.dataset.zoomSrc||shown.src}" alt="${shown.alt}"></div><p>${v.images[viewIndex].label}${lensDescription()}</p>`;document.querySelector('#modal').hidden=false;document.body.style.overflow='hidden';document.querySelector('.close').focus()}
});

render();
initializeB2B();
loadCatalogue();
loadSlideshow();
initCookieBanner();
