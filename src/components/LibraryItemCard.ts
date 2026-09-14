import { setIcon } from 'obsidian';
import type { LibraryItem, LibraryDefinition, OverlayFieldConfig } from '../services/library/types';
import { getLibraryValue } from '../services/library/viewPipeline';

export interface LibraryItemCardCallbacks { onClick: (item: LibraryItem) => void; onContextMenu?: (item: LibraryItem, event: MouseEvent) => void; }

export class LibraryItemCard {
    constructor(parent: HTMLElement, private readonly item: LibraryItem, private readonly definition: LibraryDefinition, private readonly callbacks: LibraryItemCardCallbacks) { this.render(parent); }

    private render(parent: HTMLElement): void {
        const orientation=this.definition.orientation??'vertical';
        const sideCover=orientation==='horizontal'&&Boolean(this.definition.horizontalSideCover);
        const card=parent.createDiv({cls:`lorebase-card lcl-card lcl-card-${orientation} lcl-card-size-${this.definition.cardSize??'medium'}${orientation==='horizontal'?' lorebase-card-horizontal':''}${sideCover?` lcl-horizontal-side-cover lcl-horizontal-cover-${this.definition.horizontalImageSide??'right'}`:''}`});
        card.dataset.lorebaseFilePath=this.item.file.path;card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label',this.title());
        if(orientation==='horizontal')card.style.setProperty('--lcl-horizontal-image-width',`${this.definition.horizontalImageWidth??34}%`);

        const imageWrap=card.createDiv({cls:'lorebase-card-image-wrapper'});const image=card.createDiv({cls:'lorebase-card-image lcl-cover'});imageWrap.appendChild(image);
        const cover=this.coverUrl();if(cover){image.style.backgroundImage=`url("${cover.replace(/(["\\])/g,'\\$1')}")`;image.style.backgroundSize='cover';image.style.backgroundPosition='center';}else{const fallback=image.createDiv({cls:'lcl-cover-fallback'});setIcon(fallback,this.definition.icon||'library');}

        const overlay=card.createDiv({cls:'lcl-card-overlay'});overlay.createDiv({cls:'lorebase-card-title',text:this.title()});const summary=this.summary();if(summary)overlay.createDiv({cls:'lcl-card-subtitle',text:summary});const metadata=this.metadata();if(metadata)overlay.createDiv({cls:'lcl-card-meta',text:metadata});
        this.renderCustomOverlay(card,orientation);
        this.renderBadges(card);

        const activate=(event?:MouseEvent|KeyboardEvent):void=>{event?.preventDefault();if(event instanceof MouseEvent&&event.button===2){this.callbacks.onContextMenu?.(this.item,event);return;}this.callbacks.onClick(this.item);};
        card.addEventListener('click',e=>activate(e));card.addEventListener('contextmenu',e=>activate(e));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')activate(e);});
    }

    private renderCustomOverlay(card:HTMLElement,orientation:'vertical'|'horizontal'):void{
        const fields=(this.definition.overlayLayouts?.[orientation]??this.definition.overlayFields??[]).filter(f=>f.property&&!f.property.startsWith('$'));
        if(!fields.length)return;const layer=card.createDiv({cls:'lcl-free-overlay'});
        for(const field of fields){const value=getLibraryValue(this.item,field.property);if(value===null||value===undefined||String(value).trim()==='')continue;const el=layer.createDiv({cls:`lcl-overlay-value is-${field.role}`,text:Array.isArray(value)?value.join(', '):String(value)});el.style.left=`${clamp(field.x)}%`;el.style.top=`${clamp(field.y)}%`;el.style.width=`${clamp(field.width)}%`;el.style.height=`${clamp(field.height)}%`;el.style.fontSize=`${Math.max(8,field.fontSize)}px`;el.style.fontWeight=String(Math.max(100,field.fontWeight));}
    }

    private renderBadges(card:HTMLElement):void{
        const layout=this.definition.badgeLayouts;const orientation=this.definition.orientation??'vertical';const placements=layout?.[orientation];
        const place=(kind:'favorite'|'rating'|'completion',el:HTMLElement):void=>{const p=placements?.[kind];if(!p)return;el.style.left='';el.style.right='';el.style.top='';el.style.bottom='';const x=Number(p.offsetX)||0,y=Number(p.offsetY)||0;if(p.corner.includes('left'))el.style.left=`${x}px`;else el.style.right=`${x}px`;if(p.corner.includes('top'))el.style.top=`${y}px`;else el.style.bottom=`${y}px`;};
        if(this.definition.favoriteEnabled&&truthy(getLibraryValue(this.item,'favorite'))){const group=card.createDiv({cls:'lorebase-card-badge-group lcl-custom-badge-group'});place('favorite',group);const badge=group.createDiv({cls:`lorebase-card-favorite-badge lcl-feature-badge lcl-favorite-badge${this.definition.favoriteSubtlePulse?' is-subtle-pulse':''}`});setIcon(badge,'heart');}
        if(this.definition.ratingEnabled){const numeric=Number(getLibraryValue(this.item,'rating'));if(Number.isFinite(numeric)&&numeric>0){const group=card.createDiv({cls:'lorebase-card-badge-group lcl-custom-badge-group'});place('rating',group);const badge=group.createDiv({cls:`lorebase-card-rating lcl-feature-badge lcl-rating-badge${this.definition.ratingStyle==='emoji'?' is-emoji':''}`,text:this.definition.ratingStyle==='star'?`★${numeric}`:ratingEmoji(numeric)});}}
        if(this.definition.completionDateEnabled){const raw=getLibraryValue(this.item,this.definition.completionDateProperty||'finished');const formatted=formatDate(raw,this.definition.completionDateFormat);if(formatted){const group=card.createDiv({cls:'lorebase-card-badge-group lcl-custom-badge-group'});place('completion',group);const badge=group.createDiv({cls:`lorebase-card-status lorebase-status-completed lcl-feature-badge lcl-custom-completion-badge${this.definition.statusAsIconOnly?' is-icon-only':''}`});setIcon(badge,'check');if(!this.definition.statusAsIconOnly)badge.appendText(formatted);}}
    }

    private title():string{const field=this.definition.schema.titleField;const value=field?getLibraryValue(this.item,field):null;return String(value??getLibraryValue(this.item,'name')??this.item.file.basename).trim()||this.item.file.basename;}
    private coverUrl():string|null{const field=this.definition.schema.coverField;const value=field?getLibraryValue(this.item,field):null;const raw=String(value??'').trim();if(!raw)return null;const wiki=raw.match(/^!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)?.[1];const candidate=wiki||raw;return /^https?:\/\//i.test(candidate)?candidate:null;}
    private summary():string{for(const field of ['description','summary','plot','overview']){const value=String(getLibraryValue(this.item,field)??'').trim();if(value)return value;}return '';}
    private metadata():string{return this.definition.schema.fields.map(f=>getLibraryValue(this.item,f.id)).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').slice(0,3).map(v=>Array.isArray(v)?v.join(', '):String(v)).join(' · ');}
}
function clamp(value:number):number{return Math.max(0,Math.min(100,Number.isFinite(value)?value:0));}
function truthy(value:unknown):boolean{return value===true||value==='true'||value===1||value==='1'||String(value??'').toLowerCase()==='yes';}
function ratingEmoji(value:number):string{if(value>=9)return'🤩';if(value>=8)return'😍';if(value>=7)return'😊';if(value>=6)return'🙂';if(value>=5)return'😐';if(value>=4)return'😕';if(value>=3)return'😟';if(value>=2)return'😞';return'😡';}
function formatDate(value:unknown,format:'short'|'full'|undefined):string{if(value===null||value===undefined||String(value).trim()==='')return'';const date=new Date(String(value));if(Number.isNaN(date.getTime()))return String(value);return format==='full'?date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}
