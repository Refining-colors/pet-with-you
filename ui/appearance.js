window.PetAppearance={
  async apply(base,setting,elements){
    let family=setting.family||'SimSun';
    if(family==='ShangshouSoftCandy'&&setting.source!=='file'){
      this.faces ||= new Map();
      if(!this.faces.has(family)){
        const face=new FontFace(family,'url("'+base+'/font/'+encodeURIComponent('上首软糖体.ttf')+'")');
        this.faces.set(family,face.load().then(f=>{document.fonts.add(f);return f;}).catch(e=>{this.faces.delete(family);throw e;}));
      }
      // Older settings can name a font that is not distributed in public builds.
      try{await this.faces.get(family);}catch{family='SimSun';}
    }
    if(setting.source==='file'){
      const entry=setting.customFonts.find(f=>f.id===family);if(!entry)throw new Error('找不到已导入字体');
      family='PetFont_'+entry.id.replace(/\W/g,'');
      this.faces ||= new Map();
      if(!this.faces.has(family)){
        const face=new FontFace(family,'url("'+base+'/user-font/'+encodeURIComponent(entry.id)+'")');
        this.faces.set(family,face.load().then(f=>{document.fonts.add(f);return f;}).catch(e=>{this.faces.delete(family);throw e;}));
      }
      await this.faces.get(family);
    }
    const value=JSON.stringify(family)+', "SimSun", "宋体", serif';
    for(const e of elements)e.style.fontFamily=value;
    return value;
  }
};
