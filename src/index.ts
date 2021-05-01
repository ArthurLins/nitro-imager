
import { AssetManager } from './client/core/asset/AssetManager';
import { ConfigurationEvent } from './client/core/configuration/ConfigurationEvent';
import { ConfigurationManager } from './client/core/configuration/ConfigurationManager';
import { AvatarRenderManager } from './client/nitro/avatar/AvatarRenderManager';
import { AvatarScaleType } from './client/nitro/avatar/enum/AvatarScaleType';
import { AvatarSetType } from './client/nitro/avatar/enum/AvatarSetType';
import { AvatarRenderEvent } from './client/nitro/avatar/events/AvatarRenderEvent';


class Index
{

	private imager:AvatarRenderManager;

	constructor()
	{
	    this.splash();

	    this.observe();

	    const configuration = new ConfigurationManager();
	    configuration.events.addEventListener(ConfigurationEvent.LOADED, ()=>
	    {

	        const asset = new AssetManager();
	        this.imager = new AvatarRenderManager(configuration, asset);
	        this.imager.events.addEventListener(AvatarRenderEvent.AVATAR_RENDER_READY, ()=>
	        {

	        });
	    });

	}

	private observe()
	{
	    console.log('start..');
	    const mutationObserver = new MutationObserver((muts)=>
	    {
	        console.log(muts);
	    });
	    mutationObserver.observe(document.body, { attributes: true, subtree: true });
	}

	private genImage(figureUri:string, result:Function)
	{
	    const params = new URLSearchParams(figureUri);
	    const fg = params.get('figure') ?? 'hd-99999-99999';
	    const direction = Number(params.get('direction')) ?? 2;
	    const head_direction = Number(params.get('head_direction')) ?? null;
	    const gesture = params.get('gesture') ?? params.get('action') ?? 'std';
	    const frame = Number(params.get('frame')) ?? 0;

	    this.imager.createAvatarImage(fg,AvatarScaleType.LARGE,(figure:string)=>
	    {
	        const img = this.imager.createAvatarImage(figure,AvatarScaleType.LARGE);

	        if(head_direction && direction)
	        {
	            img.setDirection(AvatarSetType.HEAD, head_direction);
	            img.setDirection(AvatarSetType.BODY, direction);
	        }
	        else if(!head_direction && direction)
	        {
	            img.setDirection(AvatarSetType.FULL, direction);
	        }
	        img.appendAction(gesture, 1);
	        img.updateAnimationByFrames(frame);
	        result(img.getCroppedImage(AvatarSetType.FULL,1).src);
	    });
	}

	private splash()
	{
	    window.console.log.apply(console, [
	        '\n%c       _   ___ __              \n      / | / (_) /__________    \n     /  |/ / / __/ ___/ __ \\   \n    / /|  / / /_/ /  / /_/ /   \n   /_/ |_/_/\\__/_/   \\____/    \n                               \n Thanks for using Nitro        \n To report bugs or issues      \n join us on Discord            \n https://discord.gg/66UR68FPgy \n                               \n',
	        'color: #FFFFFF; background: #000000; padding:0px 0;' ]);
	}

}
new Index();
