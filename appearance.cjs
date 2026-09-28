const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
class Appearance {
  constructor(dataDir){
    this.dir=path.join(dataDir,'fonts');fs.mkdirSync(this.dir,{recursive:true});
    this.store=new (require('./settings-store.cjs').SettingsStore)(dataDir);this.file=this.store.file;
    this.value=this.store.get('appearance',{family:'SimSun',source:'system',customFonts:[]});
    this.value.feedback ||= {family:'SimSun',source:'system'};
    this.value.customFonts=(this.value.customFonts||[]).filter(f=>/^[a-f0-9]{64}\.(ttf|otf)$/.test(f.id)&&fs.existsSync(path.join(this.dir,f.id)));
    for(const selection of [this.value,this.value.feedback])if(selection.source==='file'&&!this.value.customFonts.some(f=>f.id===selection.family))Object.assign(selection,{family:'SimSun',source:'system'});
    this.persist();
  }
  save(raw){
    const family=String(raw.family||'').trim();if(!family||family.length>150)throw new Error('请输入字体名称');
    if(!['system','file'].includes(raw.source))throw new Error('字体来源无效');
    if(raw.source==='file'&&!this.value.customFonts.some(f=>f.id===family))throw new Error('请先导入字体文件');
    this.value=raw.target==='feedback'?{...this.value,feedback:{family,source:raw.source}}:{...this.value,family,source:raw.source};this.persist();return this.value;
  }
  persist(){this.store.set('appearance',this.value);}
  importFile(filename,target='quota'){
    if(!filename)return this.value;
    const ext=path.extname(filename).toLowerCase();if(!['.ttf','.otf'].includes(ext))throw new Error('支持 TTF 或 OTF 字体');
    if(fs.statSync(filename).size>32*1024*1024)throw new Error('字体文件不能超过 32 MB');
    const bytes=fs.readFileSync(filename);if(bytes.readUInt32BE(0)!==0x00010000&&!['OTTO','true'].includes(bytes.subarray(0,4).toString()))throw new Error('文件不是有效的 TTF / OTF 字体');
    const id=crypto.createHash('sha256').update(bytes).digest('hex')+ext;
    fs.writeFileSync(path.join(this.dir,id),bytes);
    const fonts=this.value.customFonts.filter(f=>f.id!==id);fonts.push({id,name:path.basename(filename)});
    this.value={...this.value,customFonts:fonts};return this.save({family:id,source:'file',target});
  }
  async fonts(){
    if(!this.fontList)this.fontList=new Promise(resolve=>{
      execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; ConvertTo-Json -Compress -InputObject @((New-Object System.Drawing.Text.InstalledFontCollection).Families.Name | Sort-Object -Unique)"],{windowsHide:true,timeout:15000,maxBuffer:1024*1024},(error,stdout)=>{
        try{resolve(error?['SimSun']:JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch{resolve(['SimSun']);}
      });
    });
    return this.fontList;
  }
}
module.exports={Appearance};
