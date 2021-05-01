import { Parser } from 'xml2js';
import { AssetManager } from '../../core/asset/AssetManager';
import
	{
		IAssetManager
	} from '../../core/asset/IAssetManager';
import
	{
		NitroManager
	} from '../../core/common/NitroManager';
import
	{
		NitroEvent
	} from '../../core/events/NitroEvent';
import { IGraphicAsset } from '../../room/object/visualization/utils/IGraphicAsset';
import
	{
		FigureDataContainer
	} from '../utils/FigureDataContainer';
import
	{
		ConfigurationManager
	} from './../../core/configuration/ConfigurationManager';
import
	{
		AssetAliasCollection
	} from './alias/AssetAliasCollection';
import
	{
		AvatarAssetDownloadManager
	} from './AvatarAssetDownloadManager';
import
	{
		AvatarFigureContainer
	} from './AvatarFigureContainer';
import
	{
		AvatarImage
	} from './AvatarImage';
import
	{
		AvatarStructure
	} from './AvatarStructure';
import
	{
		HabboAvatarAnimations
	} from './data/HabboAvatarAnimations';
import
	{
		HabboAvatarGeometry
	} from './data/HabboAvatarGeometry';
import
	{
		HabboAvatarPartSets
	} from './data/HabboAvatarPartSets';
import
	{
		EffectAssetDownloadManager
	} from './EffectAssetDownloadManager';
import
	{
		AvatarRenderEvent
	} from './events/AvatarRenderEvent';
import
	{
		IAvatarEffectListener
	} from './IAvatarEffectListener';
import
	{
		IAvatarFigureContainer
	} from './IAvatarFigureContainer';
import
	{
		IAvatarImage
	} from './IAvatarImage';
import
	{
		IAvatarRenderManager
	} from './IAvatarRenderManager';
import
	{
		PlaceHolderAvatarImage
	} from './PlaceHolderAvatarImage';
import
	{
		AvatarStructureDownload
	} from './structure/AvatarStructureDownload';
import
	{
		IFigurePartSet
	} from './structure/figure/IFigurePartSet';
import
	{
		IFigureSetData
	} from './structure/IFigureSetData';
import
	{
		IStructureData
	} from './structure/IStructureData';

export class AvatarRenderManager extends NitroManager implements IAvatarRenderManager
{
	private static DEFAULT_FIGURE: string = 'hd-99999-99999';

	private _aliasCollection: AssetAliasCollection;

	private _structure: AvatarStructure;
	private _avatarAssetDownloadManager: AvatarAssetDownloadManager;
	private _effectAssetDownloadManager: EffectAssetDownloadManager;

	private _placeHolderFigure: AvatarFigureContainer;

	private _figureMapReady: boolean;
	private _effectMapReady: boolean;
	private _actionsReady: boolean;
	private _structureReady: boolean;
	private _geometryReady: boolean;
	private _partSetsReady: boolean;
	private _animationsReady: boolean;
	private _isReady: boolean;

	private _assetManager: AssetManager;
	private _configurationManager: ConfigurationManager;

	constructor(config: ConfigurationManager, asset: AssetManager)
	{
	    super();
	    this._assetManager = asset;
	    this._configurationManager = config;

	    this._structure = null;
	    this._avatarAssetDownloadManager = null;

	    this._placeHolderFigure = null;

	    this._figureMapReady = false;
	    this._effectMapReady = false;
	    this._actionsReady = false;
	    this._geometryReady = false;
	    this._partSetsReady = false;
	    this._animationsReady = false;
	    this._isReady = false;

	    this._structure = new AvatarStructure(this);

	    this.loadGeometry();
	    this.loadPartSets();
	    this.loadActions();
	    this.loadAnimations();
	    this.loadFigureData();

	    this._aliasCollection = new AssetAliasCollection(this, this._assetManager);

	    this._aliasCollection.init();

	    if(!this._avatarAssetDownloadManager)
	    {
	        this._avatarAssetDownloadManager = new AvatarAssetDownloadManager(this._configurationManager, this._assetManager, this._structure);

	        this._avatarAssetDownloadManager.addEventListener(AvatarAssetDownloadManager.DOWNLOADER_READY, this.onAvatarAssetDownloaderReady.bind(this));

	        this._avatarAssetDownloadManager.addEventListener(AvatarAssetDownloadManager.LIBRARY_LOADED, this.onAvatarAssetDownloaded.bind(this));
	    }

	    if(!this._effectAssetDownloadManager)
	    {
	        this._effectAssetDownloadManager = new EffectAssetDownloadManager(this._configurationManager, this._assetManager, this._structure);

	        this._effectAssetDownloadManager.addEventListener(EffectAssetDownloadManager.DOWNLOADER_READY, this.onEffectAssetDownloaderReady.bind(this));

	        this._effectAssetDownloadManager.addEventListener(EffectAssetDownloadManager.LIBRARY_LOADED, this.onEffectAssetDownloaded.bind(this));
	    }

	    this.checkReady();
	}

	public onDispose(): void
	{
	    if(this._avatarAssetDownloadManager)
	    {
	        this._avatarAssetDownloadManager.removeEventListener(AvatarAssetDownloadManager.DOWNLOADER_READY, this.onAvatarAssetDownloaderReady.bind(this));

	        this._avatarAssetDownloadManager.removeEventListener(AvatarAssetDownloadManager.LIBRARY_LOADED, this.onAvatarAssetDownloaded.bind(this));
	    }

	    if(this._effectAssetDownloadManager)
	    {
	        this._effectAssetDownloadManager.removeEventListener(EffectAssetDownloadManager.DOWNLOADER_READY, this.onEffectAssetDownloaderReady.bind(this));

	        this._effectAssetDownloadManager.removeEventListener(EffectAssetDownloadManager.LIBRARY_LOADED, this.onEffectAssetDownloaded.bind(this));
	    }
	}

	private loadGeometry(): void
	{
	    if(!this._structure) return;

	    this._structure._Str_1825(HabboAvatarGeometry.geometry);

	    this._geometryReady = true;

	    this.checkReady();
	}

	private loadPartSets(): void
	{
	    if(!this._structure) return;

	    this._structure._Str_1296(HabboAvatarPartSets.partSets);

	    this._partSetsReady = true;

	    this.checkReady();
	}

	private loadActions(): void
	{
	    const defaultActions = this._configurationManager.getValue < string > ('avatar.default.actions');

	    if(defaultActions) this._structure._Str_1060(this._assetManager, defaultActions);

	    const request = new XMLHttpRequest();

	    try
	    {
	        request.open('GET', this._configurationManager.getValue < string > ('avatar.actions.url'));

	        request.send();

	        request.onloadend = e =>
	        {
	            if(!this._structure) return;

	            this._structure._Str_1620(JSON.parse(request.responseText));

	            this._actionsReady = true;

	            this.checkReady();
	        };

	        request.onerror = e =>
	        {
	            throw new Error('invalid_avatar_actions');
	        };
	    }
	    catch (e)
	    {
	        this.logger.error(e);
	    }
	}

	private loadAnimations(): void
	{
	    if(!this._structure) return;

	    this._structure._Str_2229(HabboAvatarAnimations.animations);

	    this._animationsReady = true;

	    this.checkReady();
	}

	private loadFigureData(): void
	{
	    const defaultFigureData = this._configurationManager.getValue < string > ('avatar.default.figuredata');

	    if(defaultFigureData)
	    {
	        const parser = new Parser();

	        parser.parseString(defaultFigureData, (err: Error, results: any) =>
	        {
	            if(err || !results || !results.figuredata) throw new Error('invalid_default_figure_data');

	            if(this._structure) this._structure._Str_1569(results.figuredata);
	        });
	    }

	    const structureDownloader = new AvatarStructureDownload(this._configurationManager.getValue('avatar.figuredata.url'), (this._structure.figureData as IFigureSetData));

	    structureDownloader.addEventListener(AvatarStructureDownload.AVATAR_STRUCTURE_DONE, this.onAvatarStructureDownloadDone.bind(this));
	}

	private onAvatarStructureDownloadDone(event: NitroEvent): void
	{
	    this._structureReady = true;

	    this._structure.init();

	    this.checkReady();
	}

	private onAvatarAssetDownloaderReady(event: NitroEvent): void
	{
	    if(!event) return;

	    this._figureMapReady = true;

	    this.checkReady();
	}

	private onAvatarAssetDownloaded(event: NitroEvent): void
	{
	    if(!event) return;

	    this._aliasCollection.reset();
	}

	private onEffectAssetDownloaderReady(event: NitroEvent): void
	{
	    if(!event) return;

	    this._effectMapReady = true;

	    this.checkReady();
	}

	private onEffectAssetDownloaded(event: NitroEvent): void
	{
	    if(!event) return;

	    this._aliasCollection.reset();
	}

	private checkReady(): void
	{
	    if(this._isReady) return;

	    if(!this._geometryReady || !this._partSetsReady || !this._actionsReady || !this._animationsReady || !this._figureMapReady || !this._effectMapReady || !this._structureReady) return;

	    this._isReady = true;
	    if(this.events) this.events.dispatchEvent(new NitroEvent(AvatarRenderEvent.AVATAR_RENDER_READY));
	}

	public createFigureContainer(figure: string): IAvatarFigureContainer
	{
	    return new AvatarFigureContainer(figure);
	}

	public isFigureContainerReady(container: IAvatarFigureContainer): boolean
	{
	    if(!this._avatarAssetDownloadManager) return false;

	    return this._avatarAssetDownloadManager.isAvatarFigureContainerReady(container);
	}

	public createAvatarImage(figure: string, size: string, listener: Function = null, effectListener: IAvatarEffectListener = null): IAvatarImage
	{
	    if(!this._structure || !this._avatarAssetDownloadManager) return null;

	    const figureContainer = new AvatarFigureContainer(figure);

	    if(this._avatarAssetDownloadManager.isAvatarFigureContainerReady(figureContainer))
	    {
	        return new AvatarImage(this._structure, this._aliasCollection, figureContainer, size, this._effectAssetDownloadManager, effectListener);
	    }

	    if(!this._placeHolderFigure) this._placeHolderFigure = new AvatarFigureContainer(AvatarRenderManager.DEFAULT_FIGURE);

	    this._avatarAssetDownloadManager.downloadAvatarFigure(figureContainer, listener);

	    return new PlaceHolderAvatarImage(this._structure, this._aliasCollection, this._placeHolderFigure, size, this._effectAssetDownloadManager);
	}

	public downloadAvatarFigure(container: IAvatarFigureContainer, listener: Function): void
	{
	    if(!this._avatarAssetDownloadManager) return;

	    this._avatarAssetDownloadManager.downloadAvatarFigure(container, listener);
	}

	public isValidFigureSetForGender(setId: number, gender: string): boolean
	{
	    return true;
	}

	public getFigureStringWithFigureIds(k: string, _arg_2: string, _arg_3: number[]): string
	{
	    const container = new FigureDataContainer();

	    container._Str_2153(k, _arg_2);

	    const partSets: IFigurePartSet[] = this._Str_1667(_arg_3);

	    for(const partSet of partSets)
	    {
	        container._Str_2088(partSet.type, partSet.id, container.getColourIds(partSet.type));
	    }

	    return container._Str_1008();
	}

	private _Str_1667(k: number[]): IFigurePartSet[]
	{
	    const structure = this.structureData;
	    const partSets: IFigurePartSet[] = [];

	    for(const _local_4 of k)
	    {
	        const partSet = structure._Str_938(_local_4);

	        if(partSet) partSets.push(partSet);
	    }

	    return partSets;
	}

	public _Str_838(k: string, _arg_2: number): string[]
	{
	    if(!this._structure) return null;

	    return this._structure._Str_1733(k, _arg_2);
	}

	public getAssetByName(name: string): IGraphicAsset
	{
	    return this._aliasCollection.getAsset(name);
	}

	public get assets(): IAssetManager
	{
	    return this._assetManager;
	}

	public get isReady(): boolean
	{
	    return this._isReady;
	}

	public get structure(): AvatarStructure
	{
	    return this._structure;
	}

	public get structureData(): IStructureData
	{
	    if(this._structure) return this._structure.figureData;

	    return null;
	}

	public get downloadManager(): AvatarAssetDownloadManager
	{
	    return this._avatarAssetDownloadManager;
	}
}
