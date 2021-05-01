import { IAssetManager } from '../../core/asset/IAssetManager';
import { NitroLogger } from '../../core/common/logger/NitroLogger';
import { ConfigurationManager } from '../../core/configuration/ConfigurationManager';
import { EventDispatcher } from '../../core/events/EventDispatcher';
import { NitroEvent } from '../../core/events/NitroEvent';
import { AvatarAssetDownloadLibrary } from './AvatarAssetDownloadLibrary';
import { AvatarStructure } from './AvatarStructure';
import { AvatarRenderEvent } from './events/AvatarRenderEvent';
import { AvatarRenderLibraryEvent } from './events/AvatarRenderLibraryEvent';
import { IAvatarFigureContainer } from './IAvatarFigureContainer';

export class AvatarAssetDownloadManager extends EventDispatcher
{
    public static DOWNLOADER_READY: string  = 'AADM_DOWNLOADER_READY';
    public static LIBRARY_LOADED: string    = 'AADM_LIBRARY_LOADED';

    private static MAX_DOWNLOADS: number    = 2;

    private _assets: IAssetManager;
    private _structure: AvatarStructure;

    private _missingMandatoryLibs: string[];
    private _figureMap: Map<string, AvatarAssetDownloadLibrary[]>;
    private _pendingContainers: [ IAvatarFigureContainer, Function ][];
    private _figureListeners: Map<string, Function[]>;
    private _incompleteFigures: Map<string, AvatarAssetDownloadLibrary[]>;
    private _pendingDownloadQueue: AvatarAssetDownloadLibrary[];
    private _currentDownloads: AvatarAssetDownloadLibrary[];
    private _libraryNames: string[];
    private _isReady: boolean;
	private _configurationManager: ConfigurationManager;

	constructor(configs:ConfigurationManager,assets: IAssetManager, structure: AvatarStructure)
	{
	    super();

	    this._configurationManager = configs;

	    this._assets                = assets;
	    this._structure             = structure;

	    this._missingMandatoryLibs  = this._configurationManager.getValue<string[]>('avatar.mandatory.libraries');
	    this._figureMap             = new Map();
	    this._pendingContainers     = [];
	    this._figureListeners       = new Map();
	    this._incompleteFigures     = new Map();
	    this._pendingDownloadQueue  = [];
	    this._currentDownloads      = [];
	    this._libraryNames          = [];
	    this._isReady               = false;

	    this.loadFigureMap();

	    this._structure.renderManager.events.addEventListener(AvatarRenderEvent.AVATAR_RENDER_READY, this.onAvatarRenderReady.bind(this));
	}

	private loadFigureMap(): void
	{
	    const request = new XMLHttpRequest();

	    try
	    {
	        request.open('GET', this._configurationManager.getValue<string>('avatar.figuremap.url'));

	        request.send();

	        request.onloadend = e =>
	        {
	            if(request.responseText)
	            {
	                const data = JSON.parse(request.responseText);

	                this.processFigureMap(data.libraries);

	                this.processMissingLibraries();

	                this._isReady = true;

	                this.dispatchEvent(new NitroEvent(AvatarAssetDownloadManager.DOWNLOADER_READY));
	            }
	        };

	        request.onerror = e =>
	        {
	            throw new Error('invalid_avatar_figure_map');
	        };
	    }

	    catch (e)
	    {
	        NitroLogger.log(e);
	    }
	}

	private processFigureMap(data: any): void
	{
	    if(!data) return;

	    for(const library of data)
	    {
	        if(!library) continue;

	        const id        = (library.id as string);
	        const revision  = (library.revision as number);

	        if(this._libraryNames.indexOf(id) >= 0) continue;

	        this._libraryNames.push(id);

	        const downloadLibrary = new AvatarAssetDownloadLibrary(id, revision, this._assets,this._configurationManager.getValue<string>('avatar.asset.url'));

	        downloadLibrary.addEventListener(AvatarRenderLibraryEvent.DOWNLOAD_COMPLETE, this.onLibraryLoaded.bind(this));

	        for(const part of library.parts)
	        {
	            const id            = (part.id as string);
	            const type          = (part.type as string);
	            const partString    = (type + ':' + id);

	            let existing = this._figureMap.get(partString);

	            if(!existing) existing = [];

	            existing.push(downloadLibrary);

	            this._figureMap.set(partString, existing);
	        }
	    }
	}

	private onAvatarRenderReady(event: NitroEvent): void
	{
	    if(!event) return;

	    for(const [ container, listener ] of this._pendingContainers)
	    {
	        this.downloadAvatarFigure(container, listener);
	    }

	    this._pendingContainers = [];
	}

	private onLibraryLoaded(event: AvatarRenderLibraryEvent): void
	{
	    if(!event || !event.library) return;

	    const loadedFigures: string[] = [];

	    for(const [ figure, libraries ] of this._incompleteFigures.entries())
	    {
	        let isReady = true;

	        for(const library of libraries)
	        {
	            if(!library || library.isLoaded) continue;

	            isReady = false;

	            break;
	        }

	        if(isReady)
	        {
	            loadedFigures.push(figure);

	            const listeners = this._figureListeners.get(figure);

	            if(listeners)
	            {
	                for(const listener of listeners)
	                {
	                    if(!listener) continue;

	                    listener(figure);
	                }
	            }

	            this._figureListeners.delete(figure);

	            this.dispatchEvent(new NitroEvent(AvatarAssetDownloadManager.LIBRARY_LOADED));
	        }
	    }

	    for(const figure of loadedFigures)
	    {
	        if(!figure) continue;

	        this._incompleteFigures.delete(figure);
	    }

	    let index = 0;

	    while(index < this._currentDownloads.length)
	    {
	        const download = this._currentDownloads[index];

	        if(download)
	        {
	            if(download.libraryName === event.library.libraryName) this._currentDownloads.splice(index, 1);
	        }

	        index++;
	    }
	}

	public processMissingLibraries(): void
	{
	    const libraries = this._missingMandatoryLibs.slice();

	    for(const library of libraries)
	    {
	        if(!library) continue;

	        const map = this._figureMap.get(library);

	        if(map) for(const avatar of map) avatar && this.downloadLibrary(avatar);
	    }
	}

	public isAvatarFigureContainerReady(container: IAvatarFigureContainer): boolean
	{
	    if(!this._isReady || !this._structure.renderManager.isReady)
	    {
	        return false;
	    }

	    const pendingLibraries = this.getAvatarFigurePendingLibraries(container);

	    return !pendingLibraries.length;
	}

	private getAvatarFigurePendingLibraries(container: IAvatarFigureContainer): AvatarAssetDownloadLibrary[]
	{
	    const pendingLibraries: AvatarAssetDownloadLibrary[] = [];

	    if(!container || !this._structure) return pendingLibraries;

	    const figureData = this._structure.figureData;

	    if(!figureData) return pendingLibraries;

	    const setKeys = container._Str_1016();

	    for(const key of setKeys)
	    {
	        const set = figureData._Str_740(key);

	        if(!set) continue;

	        const figurePartSet = set._Str_1020(container.getPartSetId(key));

	        if(!figurePartSet) continue;

	        for(const part of figurePartSet._Str_806)
	        {
	            if(!part) continue;

	            const name      = (part.type + ':' + part.id);
	            const existing  = this._figureMap.get(name);

	            if(existing === undefined) continue;

	            for(const library of existing)
	            {
	                if(!library || library.isLoaded) continue;

	                if(pendingLibraries.indexOf(library) >= 0) continue;

	                pendingLibraries.push(library);
	            }
	        }
	    }

	    return pendingLibraries;
	}

	public downloadAvatarFigure(container: IAvatarFigureContainer, listener: Function): void
	{
	    if(!this._isReady || !this._structure.renderManager.isReady)
	    {
	        this._pendingContainers.push([ container, listener ]);

	        return;
	    }

	    const figure            = container._Str_1008();
	    const pendingLibraries  = this.getAvatarFigurePendingLibraries(container);

	    if(pendingLibraries && pendingLibraries.length)
	    {
	        if(listener)
	        {
	            let listeners = this._figureListeners.get(figure);

	            if(!listeners)
	            {
	                listeners = [];

	                this._figureListeners.set(figure, listeners);
	            }

	            listeners.push(listener);
	        }

	        this._incompleteFigures.set(figure, pendingLibraries);

	        for(const library of pendingLibraries)
	        {
	            if(!library) continue;

	            this.downloadLibrary(library);
	        }
	    }
	    else
	    {
	        if(listener) listener(figure);
	    }
	}

	private downloadLibrary(library: AvatarAssetDownloadLibrary): void
	{
	    if(!library || library.isLoaded) return;

	    if((this._pendingDownloadQueue.indexOf(library) >= 0) || (this._currentDownloads.indexOf(library) >= 0)) return;

	    this._pendingDownloadQueue.push(library);

	    this.processDownloadQueue();
	}

	private processDownloadQueue(): void
	{
	    while(this._pendingDownloadQueue.length)
	    {
	        const library = this._pendingDownloadQueue[0];

	        library.downloadAsset();

	        this._currentDownloads.push(this._pendingDownloadQueue.shift());
	    }
	}
}
