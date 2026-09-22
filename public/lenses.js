// Colours sampled visually from the supplied reference. Names describe lens
// options, not new SKUs. Screen previews do not establish size compatibility.
window.dookLenses=[
 {name:'Dark green 01',detail:'GN01-3 · Category 3',rgb:[84,101,80],opacity:.66,swatch:'#929d8e'},
 {name:'Light pink 01',detail:'Light pink',rgb:[180,153,142],opacity:.38,swatch:'#ddd0ca'},
 {name:'Brown graduated 01',detail:'Category 2 · Graduated',rgb:[106,91,65],opacity:.62,bottom:.19,swatch:'linear-gradient(#a39c8d,#e3dfd6)'},
 {name:'Dark brown 01',detail:'Category 3',rgb:[104,92,70],opacity:.62,swatch:'#a29b8c'},
 {name:'Clear anti blue light',detail:'Clear',rgb:[126,154,154],opacity:.10,swatch:'#e8eded'},
 {name:'Grey graduated 01',detail:'Category 2 · Graduated',rgb:[86,91,92],opacity:.62,bottom:.18,swatch:'linear-gradient(#929697,#e4e6e6)'},
 {name:'Dark grey 01',detail:'Category 3 · Polaroid',rgb:[83,91,86],opacity:.67,swatch:'#929893'},
 {name:'Yellow 01',detail:'Night vision',rgb:[201,188,71],opacity:.42,swatch:'#e4dfa7'},
 {name:'Clear anti blue light +1.0',detail:'Clear · +1.0',rgb:[126,154,154],opacity:.10,swatch:'#e8eded'},
 {name:'Blue graduated 01',detail:'Category 1 · Graduated',rgb:[90,131,154],opacity:.51,bottom:.23,swatch:'linear-gradient(#9aafbc,#d9e2e7)'}
];
function lensOptions(id){
 if(!['A001','AN001'].includes(id))return '';
 return `<section class="lens-options" aria-label="Choose DOOK lens colour"><div class="option-label"><span>DOOK lenses</span><strong class="selected-lens" aria-live="polite">${lensIndex<0?'Frame only':window.dookLenses[lensIndex].name}</strong></div><div class="lens-options-grid"><button type="button" class="lens-choice ${lensIndex<0?'selected':''}" data-dook-colour="-1" aria-pressed="${lensIndex<0}"><span class="lens-chip no-lens" aria-hidden="true"></span><span>Frame only<small>Without a DOOK</small></span></button>${window.dookLenses.map((lens,i)=>`<button type="button" class="lens-choice ${lensIndex===i?'selected':''}" data-dook-colour="${i}" aria-pressed="${lensIndex===i}"><span class="lens-chip" style="background:${lens.swatch}" aria-hidden="true"></span><span>${lens.name}<small>${lens.detail}</small></span></button>`).join('')}</div><p class="lens-preview-note">Illustrative fit and colours. Actual lenses may differ. Please confirm model, size and availability with DOOK.</p></section>`;
}
// Reuse the photographed DOOK rims and magnet tabs from the homepage.
// Each photograph remains a separate registered layer throughout the animation.
(()=>{
 const photos=new Map(),scenes=new Map(),tinted=new Map();
 function load(src){if(!photos.has(src))photos.set(src,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{photos.delete(src);reject(new Error('Photo unavailable'))};image.src=src}));return photos.get(src)}
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
 async function clickOn(side,lens){
  const key=side+'|'+lens.name;if(tinted.has(key))return tinted.get(key);
  const photo=await load('/assets/dook-'+side+'.png'),output=canvas(photo.naturalWidth,photo.naturalHeight),ctx=output.getContext('2d',{willReadFrequently:true});ctx.drawImage(photo,0,0);
  if(lens.name!=='Dark green 01'){
   const pixels=ctx.getImageData(0,0,output.width,output.height),d=pixels.data;
   // The green lens is chromatically distinct from the neutral metal rim.
   // Keep the original rim, highlights and attachment tabs byte-for-byte.
   for(let i=0;i<d.length;i+=4){if(d[i+3]>0&&d[i+1]>d[i]+3&&d[i+1]>d[i+2]+7){
    const y=Math.floor(i/4/output.width),t=Math.max(0,Math.min(1,(y-238)/236));
    const opacity=lens.opacity+(lens.bottom===undefined?0:(lens.bottom-lens.opacity)*t),light=(d[i+1]-105)*.35;
    d[i]=Math.max(0,Math.min(255,lens.rgb[0]+light));d[i+1]=Math.max(0,Math.min(255,lens.rgb[1]+light));d[i+2]=Math.max(0,Math.min(255,lens.rgb[2]+light));d[i+3]=Math.round(255*opacity);
   }}ctx.putImageData(pixels,0,0);
  }
  tinted.set(key,output);return output;
 }
 window.makeDookScene=async(model,src,lens)=>{
  const image=await load(src);
  if(!['A001','AN001'].includes(model))return {base:src,composite:src,layers:[],width:image.naturalWidth,height:image.naturalHeight};
  const key=src+'|'+(lens?.name||'frame');if(scenes.has(key))return scenes.get(key);
  const crop=model==='A001'?[220,430,1680,640]:[0,0,image.naturalWidth,image.naturalHeight];
  const w=1200,h=Math.round(crop[3]/crop[2]*w),output=canvas(w,h),ctx=output.getContext('2d');ctx.drawImage(image,...crop,0,0,w,h);
  const result={base:output.toDataURL('image/png'),layers:[],width:w,height:h};
  if(lens){
   const clips=await Promise.all(['l','r'].map(side=>clickOn(side,lens)));
   for(let i=0;i<clips.length;i++){
    const layer=canvas(w,h),lc=layer.getContext('2d');
    if(model==='A001'){
     // Identical registration to the supplied full-canvas homepage layers.
     lc.drawImage(clips[i],-crop[0]*w/crop[2],-crop[1]*h/crop[3],image.naturalWidth*w/crop[2],image.naturalHeight*h/crop[3]);
    }else{
     // AN001 is a visual fit of the same reference rim; availability and exact
     // model/size compatibility remain subject to DOOK confirmation.
     const blue=src.includes('c2'),sx=i===0?159:542,sw=i===0?308:309;
     const box=blue?(i===0?[121,61,554,460]:[824,61,554,453]):(i===0?[120,53,554,453]:[825,53,554,453]);
     lc.drawImage(clips[i],sx,233,sw,248,box[0]*w/1500,box[1]*h/image.naturalHeight,box[2]*w/1500,box[3]*h/image.naturalHeight);
    }
    result.layers.push(layer.toDataURL('image/png'));ctx.drawImage(layer,0,0);
   }
  }
  result.composite=output.toDataURL('image/png');scenes.set(key,result);return result;
 };
})();
