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
 * The loading screen: the club logo, assembled from its own pieces, over a percentage.
 *
 * It is plain markup plus one inline script, so it paints from the first byte
 * of the document and runs before React hydrates. The script eases the counter
 * toward 90%, waits for `window.__bootDone()` (ClubSite calls it once content
 * is ready), then runs to 100 and plays its assembly backwards. Once per session: a visitor who
 * already saw it never sees it again, and without JavaScript it never covers
 * the page. Everything it hides is real content already in the document.
 */
const script = `(function(){
var d=document.documentElement;
try{if(sessionStorage.getItem('ucas-boot')){d.classList.add('boot-seen');return}}catch(e){}
var p=location.pathname;if(p==='/'||p==='/en'||p==='/en/'){d.classList.add('hero-opening');window.__bootWaitHero=true}
var ring=document.getElementById('boot-ring'),t0=performance.now(),shown=0,finishing=false;
function leave(){d.classList.add('booted');try{sessionStorage.setItem('ucas-boot','1')}catch(e){}}
function tick(){
var t=performance.now()-t0;
var target=finishing?100:90*(1-Math.exp(-t/1400));
shown+=(target-shown)*(finishing?0.22:0.1);
if(ring)ring.style.strokeDashoffset=100-shown;
if(finishing&&shown>99.4){if(ring)ring.style.strokeDashoffset=0;setTimeout(leave,220);return}
requestAnimationFrame(tick)}
window.__bootDone=function(){setTimeout(function(){finishing=true},Math.max(0,700-(performance.now()-t0)))};
setTimeout(function(){window.__bootDone()},8000);
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
