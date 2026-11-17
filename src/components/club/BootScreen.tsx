import bracketLeft from "@/assets/logo/bracket-left.webp";
import bracketRight from "@/assets/logo/bracket-right.webp";
import dotTop from "@/assets/logo/dot-top.webp";
import dotBottom from "@/assets/logo/dot-bottom.webp";

declare global {
  interface Window {
    /** Called by the app once content is ready; the screen then finishes and leaves. */
    __bootDone?: () => void;
    /** Set on the home page: the hero's opening, not the shell, says when content is ready. */
    __bootWaitHero?: boolean;
  }
}

/**
 * The loading screen: the club logo, assembled from its own pieces, with a ring
 * that draws as the page really loads.
 *
 * It is plain markup plus one inline script, so it paints from the first byte
 * of the document and runs before React hydrates. Progress is the weighted sum
 * of four real signals, and it never moves without one: the document is parsed,
 * the images the page loads eagerly have arrived, the window load event has
 * fired and the fonts are ready, and the app says its content is ready
 * (`window.__bootDone()`: ClubSite after the data arrives, or the home hero once
 * its opening is in place). There is no minimum time: a cached visit leaves as
 * soon as it is ready. After 8 seconds it leaves regardless, so a stalled request
 * can never trap the visitor. Once per session; without JavaScript it never covers
 * the page. Everything it hides is real content already in the document.
 */
const script = `(function(){
var d=document.documentElement;
try{if(sessionStorage.getItem('ucas-boot')){d.classList.add('boot-seen');return}}catch(e){}
var p=location.pathname;if(p==='/'||p==='/en'||p==='/en/'){d.classList.add('hero-opening');window.__bootWaitHero=true}
var ring=document.getElementById('boot-ring'),shown=0,app=false,loaded=false,fonts=false,forced=false,left=false;
function leave(){if(left)return;left=true;d.classList.add('booted');try{sessionStorage.setItem('ucas-boot','1')}catch(e){}}
function images(){
var list=document.images,total=0,ready=0;
for(var i=0;i<list.length;i++){var img=list[i];if(img.loading==='lazy')continue;total++;if(img.complete)ready++}
return total?ready/total:1}
function real(){
if(forced)return 100;
var parsed=document.readyState!=='loading';
return (parsed?15:0)+(parsed?30*images():0)+(loaded&&fonts?20:0)+(app?35:0)}
function load(){loaded=true;if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){fonts=true});else fonts=true}
if(document.readyState==='complete')load();else window.addEventListener('load',load);
function tick(){
var target=real();
shown+=(target-shown)*0.15;
if(ring)ring.style.strokeDashoffset=100-shown;
if(target>=100&&shown>99.4){if(ring)ring.style.strokeDashoffset=0;setTimeout(leave,220);return}
requestAnimationFrame(tick)}
window.__bootDone=function(){app=true};
setTimeout(function(){forced=true},8000);
requestAnimationFrame(tick);
})();`;

/** The logo's four pieces, cut from ucas-logo.webp, set back at their original places. */
const pieces = [
  ["left", bracketLeft, { left: "12.24%", top: "5.99%", width: "39.32%" }],
  ["right", bracketRight, { left: "49.48%", top: "30.47%", width: "38.54%" }],
  ["dot-top", dotTop, { left: "66.15%", top: "21.35%", width: "17.45%" }],
  ["dot-bottom", dotBottom, { left: "15.89%", top: "65.36%", width: "17.19%" }],
] as const;

export function BootScreen() {
  return (
    <>
      <div id="boot" className="boot" aria-hidden="true">
        <div className="boot-stage" dir="ltr">
          <div className="boot-logo">
            {/* The diamond is drawn as the percentage climbs; same size as HeroOpening's shape. */}
            <svg className="boot-ring" viewBox="0 0 100 100" aria-hidden="true">
              <rect
                id="boot-ring"
                suppressHydrationWarning
                x="-12.5"
                y="-12.5"
                width="125"
                height="125"
                rx="14"
                pathLength={100}
                transform="rotate(45 50 50)"
              />
            </svg>
            {pieces.map(([name, src, position]) => (
              <img
                key={name}
                src={src}
                alt=""
                className={`boot-piece boot-piece-${name}`}
                style={position}
                decoding="async"
              />
            ))}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <noscript>
        <style>{"#boot{display:none}"}</style>
      </noscript>
    </>
  );
}
