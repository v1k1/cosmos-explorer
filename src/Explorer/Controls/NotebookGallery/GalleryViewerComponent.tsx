import {
  Dropdown,
  FocusZone,
  IDropdownOption,
  IPageSpecification,
  IPivotItemProps,
  IPivotProps,
  IRectangle,
  Label,
  List,
  Pivot,
  PivotItem,
  SearchBox,
  Stack
} from "office-ui-fabric-react";
import * as React from "react";
import * as Logger from "../../../Common/Logger";
import * as ViewModels from "../../../Contracts/ViewModels";
import { IGalleryItem, JunoClient } from "../../../Juno/JunoClient";
import * as GalleryUtils from "../../../Utils/GalleryUtils";
import { NotificationConsoleUtils } from "../../../Utils/NotificationConsoleUtils";
import { ConsoleDataType } from "../../Menus/NotificationConsole/NotificationConsoleComponent";
import { DialogComponent, DialogProps } from "../DialogReactComponent/DialogComponent";
import { GalleryCardComponent, GalleryCardComponentProps } from "./Cards/GalleryCardComponent";
import "./GalleryViewerComponent.less";
import { HttpStatusCodes } from "../../../Common/Constants";

export interface GalleryViewerComponentProps {
  container?: ViewModels.Explorer;
  junoClient: JunoClient;
  selectedTab: GalleryTab;
  sortBy: SortBy;
  searchText: string;
  onSelectedTabChange: (newTab: GalleryTab) => void;
  onSortByChange: (sortBy: SortBy) => void;
  onSearchTextChange: (searchText: string) => void;
}

export enum GalleryTab {
  OfficialSamples,
  PublicGallery,
  Favorites,
  Published
}

export enum SortBy {
  MostViewed,
  MostDownloaded,
  MostFavorited,
  MostRecent
}

interface GalleryViewerComponentState {
  sampleNotebooks: IGalleryItem[];
  publicNotebooks: IGalleryItem[];
  favoriteNotebooks: IGalleryItem[];
  publishedNotebooks: IGalleryItem[];
  selectedTab: GalleryTab;
  sortBy: SortBy;
  searchText: string;
  dialogProps: DialogProps;
}

interface GalleryTabInfo {
  tab: GalleryTab;
  content: JSX.Element;
}

export class GalleryViewerComponent extends React.Component<GalleryViewerComponentProps, GalleryViewerComponentState>
  implements GalleryUtils.DialogEnabledComponent {
  public static readonly OfficialSamplesTitle = "Official samples";
  public static readonly PublicGalleryTitle = "Public gallery";
  public static readonly FavoritesTitle = "Liked";
  public static readonly PublishedTitle = "Your published work";

  private static readonly mostViewedText = "Most viewed";
  private static readonly mostDownloadedText = "Most downloaded";
  private static readonly mostFavoritedText = "Most favorited";
  private static readonly mostRecentText = "Most recent";

  private static readonly sortingOptions: IDropdownOption[] = [
    {
      key: SortBy.MostViewed,
      text: GalleryViewerComponent.mostViewedText
    },
    {
      key: SortBy.MostDownloaded,
      text: GalleryViewerComponent.mostDownloadedText
    },
    {
      key: SortBy.MostFavorited,
      text: GalleryViewerComponent.mostFavoritedText
    },
    {
      key: SortBy.MostRecent,
      text: GalleryViewerComponent.mostRecentText
    }
  ];

  private sampleNotebooks: IGalleryItem[];
  private publicNotebooks: IGalleryItem[];
  private favoriteNotebooks: IGalleryItem[];
  private publishedNotebooks: IGalleryItem[];
  private columnCount: number;
  private rowCount: number;

  constructor(props: GalleryViewerComponentProps) {
    super(props);

    this.state = {
      sampleNotebooks: undefined,
      publicNotebooks: undefined,
      favoriteNotebooks: undefined,
      publishedNotebooks: undefined,
      selectedTab: props.selectedTab,
      sortBy: props.sortBy,
      searchText: props.searchText,
      dialogProps: undefined
    };

    this.loadTabContent(this.state.selectedTab, this.state.searchText, this.state.sortBy, false);
    if (this.props.container) {
      this.loadFavoriteNotebooks(this.state.searchText, this.state.sortBy, false); // Need this to show correct favorite button state
    }
  }

  setDialogProps = (dialogProps: DialogProps): void => {
    this.setState({ dialogProps });
  };

  public render(): JSX.Element {
    const tabs: GalleryTabInfo[] = [this.createTab(GalleryTab.OfficialSamples, this.state.sampleNotebooks)];

    if (this.props.container) {
      if (this.props.container.isGalleryPublishEnabled()) {
        tabs.push(this.createTab(GalleryTab.PublicGallery, this.state.publicNotebooks));
      }

      tabs.push(this.createTab(GalleryTab.Favorites, this.state.favoriteNotebooks));

      if (this.props.container.isGalleryPublishEnabled()) {
        tabs.push(this.createTab(GalleryTab.Published, this.state.publishedNotebooks));
      }
    }

    const pivotProps: IPivotProps = {
      onLinkClick: this.onPivotChange,
      selectedKey: GalleryTab[this.state.selectedTab]
    };

    const pivotItems = tabs.map(tab => {
      const pivotItemProps: IPivotItemProps = {
        itemKey: GalleryTab[tab.tab],
        style: { marginTop: 20 },
        headerText: GalleryUtils.getTabTitle(tab.tab)
      };

      return (
        <PivotItem key={pivotItemProps.itemKey} {...pivotItemProps}>
          {tab.content}
        </PivotItem>
      );
    });

    return (
      <div className="galleryContainer">
        <Pivot {...pivotProps}>{pivotItems}</Pivot>

        {this.state.dialogProps && <DialogComponent {...this.state.dialogProps} />}
      </div>
    );
  }

  private createTab(tab: GalleryTab, data: IGalleryItem[]): GalleryTabInfo {
    return {
      tab,
      content: this.createTabContent(data)
    };
  }

  private createTabContent(data: IGalleryItem[]): JSX.Element {
    return (
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal tokens={{ childrenGap: 20 }}>
          <Stack.Item grow>
            <SearchBox value={this.state.searchText} placeholder="Search" onChange={this.onSearchBoxChange} />
          </Stack.Item>
          <Stack.Item>
            <Label>Sort by</Label>
          </Stack.Item>
          <Stack.Item styles={{ root: { minWidth: 200 } }}>
            <Dropdown
              options={GalleryViewerComponent.sortingOptions}
              selectedKey={this.state.sortBy}
              onChange={this.onDropdownChange}
            />
          </Stack.Item>
        </Stack>

        {data && this.createCardsTabContent(data)}
      </Stack>
    );
  }

  private createCardsTabContent(data: IGalleryItem[]): JSX.Element {
    return (
      <FocusZone>
        <List
          items={data}
          getPageSpecification={this.getPageSpecification}
          renderedWindowsAhead={3}
          onRenderCell={this.onRenderCell}
        />
      </FocusZone>
    );
  }

  private loadTabContent(tab: GalleryTab, searchText: string, sortBy: SortBy, offline: boolean): void {
    switch (tab) {
      case GalleryTab.OfficialSamples:
        this.loadSampleNotebooks(searchText, sortBy, offline);
        break;

      case GalleryTab.PublicGallery:
        this.loadPublicNotebooks(searchText, sortBy, offline);
        break;

      case GalleryTab.Favorites:
        this.loadFavoriteNotebooks(searchText, sortBy, offline);
        break;

      case GalleryTab.Published:
        this.loadPublishedNotebooks(searchText, sortBy, offline);
        break;

      default:
        throw new Error(`Unknown tab ${tab}`);
    }
  }

  private async loadSampleNotebooks(searchText: string, sortBy: SortBy, offline: boolean): Promise<void> {
    if (!offline) {
      try {
        const response = await this.props.junoClient.getSampleNotebooks();
        if (response.status !== HttpStatusCodes.OK && response.status !== HttpStatusCodes.NoContent) {
          throw new Error(`Received HTTP ${response.status} when loading sample notebooks`);
        }

        this.sampleNotebooks = response.data;
      } catch (error) {
        const message = `Failed to load sample notebooks: ${error}`;
        Logger.logError(message, "GalleryViewerComponent/loadSampleNotebooks");
        NotificationConsoleUtils.logConsoleMessage(ConsoleDataType.Error, message);
      }
    }

    this.setState({
      sampleNotebooks: this.sampleNotebooks && [...this.sort(sortBy, this.search(searchText, this.sampleNotebooks))]
    });
  }

  private async loadPublicNotebooks(searchText: string, sortBy: SortBy, offline: boolean): Promise<void> {
    if (!offline) {
      try {
        const response = await this.props.junoClient.getPublicNotebooks();
        if (response.status !== HttpStatusCodes.OK && response.status !== HttpStatusCodes.NoContent) {
          throw new Error(`Received HTTP ${response.status} when loading public notebooks`);
        }

        this.publicNotebooks = response.data;
      } catch (error) {
        const message = `Failed to load public notebooks: ${error}`;
        Logger.logError(message, "GalleryViewerComponent/loadPublicNotebooks");
        NotificationConsoleUtils.logConsoleMessage(ConsoleDataType.Error, message);
      }
    }

    this.setState({
      publicNotebooks: this.publicNotebooks && [...this.sort(sortBy, this.search(searchText, this.publicNotebooks))]
    });
  }

  private async loadFavoriteNotebooks(searchText: string, sortBy: SortBy, offline: boolean): Promise<void> {
    if (!offline) {
      try {
        const response = await this.props.junoClient.getFavoriteNotebooks();
        if (response.status !== HttpStatusCodes.OK && response.status !== HttpStatusCodes.NoContent) {
          throw new Error(`Received HTTP ${response.status} when loading favorite notebooks`);
        }

        this.favoriteNotebooks = response.data;
      } catch (error) {
        const message = `Failed to load favorite notebooks: ${error}`;
        Logger.logError(message, "GalleryViewerComponent/loadFavoriteNotebooks");
        NotificationConsoleUtils.logConsoleMessage(ConsoleDataType.Error, message);
      }
    }

    this.setState({
      favoriteNotebooks: this.favoriteNotebooks && [
        ...this.sort(sortBy, this.search(searchText, this.favoriteNotebooks))
      ]
    });

    // Refresh favorite button state
    if (this.state.selectedTab !== GalleryTab.Favorites) {
      this.refreshSelectedTab();
    }
  }

  private async loadPublishedNotebooks(searchText: string, sortBy: SortBy, offline: boolean): Promise<void> {
    if (!offline) {
      try {
        const response = await this.props.junoClient.getPublishedNotebooks();
        if (response.status !== HttpStatusCodes.OK && response.status !== HttpStatusCodes.NoContent) {
          throw new Error(`Received HTTP ${response.status} when loading published notebooks`);
        }

        this.publishedNotebooks = response.data;
      } catch (error) {
        const message = `Failed to load published notebooks: ${error}`;
        Logger.logError(message, "GalleryViewerComponent/loadPublishedNotebooks");
        NotificationConsoleUtils.logConsoleMessage(ConsoleDataType.Error, message);
      }
    }

    this.setState({
      publishedNotebooks: this.publishedNotebooks && [
        ...this.sort(sortBy, this.search(searchText, this.publishedNotebooks))
      ]
    });
  }

  private search(searchText: string, data: IGalleryItem[]): IGalleryItem[] {
    if (searchText) {
      return data?.filter(item => this.isGalleryItemPresent(searchText, item));
    }

    return data;
  }

  private isGalleryItemPresent(searchText: string, item: IGalleryItem): boolean {
    const toSearch = searchText.trim().toUpperCase();
    const searchData: string[] = [
      item.author.toUpperCase(),
      item.description.toUpperCase(),
      item.name.toUpperCase(),
      ...item.tags?.map(tag => tag.toUpperCase())
    ];

    for (const data of searchData) {
      if (data?.indexOf(toSearch) !== -1) {
        return true;
      }
    }
    return false;
  }

  private sort(sortBy: SortBy, data: IGalleryItem[]): IGalleryItem[] {
    return data?.sort((a, b) => {
      switch (sortBy) {
        case SortBy.MostViewed:
          return b.views - a.views;
        case SortBy.MostDownloaded:
          return b.downloads - a.downloads;
        case SortBy.MostFavorited:
          return b.favorites - a.favorites;
        case SortBy.MostRecent:
          return Date.parse(b.created) - Date.parse(a.created);
        default:
          throw new Error(`Unknown sorting condition ${sortBy}`);
      }
    });
  }

  private refreshSelectedTab(item?: IGalleryItem): void {
    if (item) {
      this.updateGalleryItem(item);
    }
    this.loadTabContent(this.state.selectedTab, this.state.searchText, this.state.sortBy, true);
  }

  private updateGalleryItem(updatedItem: IGalleryItem): void {
    this.replaceGalleryItem(updatedItem, this.sampleNotebooks);
    this.replaceGalleryItem(updatedItem, this.publicNotebooks);
    this.replaceGalleryItem(updatedItem, this.favoriteNotebooks);
    this.replaceGalleryItem(updatedItem, this.publishedNotebooks);
  }

  private replaceGalleryItem(item: IGalleryItem, items?: IGalleryItem[]): void {
    const index = items?.findIndex(value => value.id === item.id);
    if (index !== -1) {
      items?.splice(index, 1, item);
    }
  }

  private getPageSpecification = (itemIndex?: number, visibleRect?: IRectangle): IPageSpecification => {
    this.columnCount = Math.floor(visibleRect.width / GalleryCardComponent.CARD_WIDTH);
    this.rowCount = Math.floor(visibleRect.height / GalleryCardComponent.CARD_HEIGHT);

    return {
      height: visibleRect.height,
      itemCount: this.columnCount * this.rowCount
    };
  };

  private onRenderCell = (data?: IGalleryItem): JSX.Element => {
    const isFavorite = this.favoriteNotebooks?.find(item => item.id === data.id) !== undefined;
    const props: GalleryCardComponentProps = {
      data,
      isFavorite,
      showDelete: this.state.selectedTab === GalleryTab.Published,
      onClick: () => this.openNotebook(data, isFavorite),
      onTagClick: this.loadTaggedItems,
      onFavoriteClick: () => this.favoriteItem(data),
      onUnfavoriteClick: () => this.unfavoriteItem(data),
      onDownloadClick: () => this.downloadItem(data),
      onDeleteClick: () => this.deleteItem(data)
    };

    return (
      <div style={{ float: "left", padding: 10 }}>
        <GalleryCardComponent {...props} />
      </div>
    );
  };

  private openNotebook = (data: IGalleryItem, isFavorite: boolean): void => {
    if (this.props.container && this.props.junoClient) {
      this.props.container.openGallery(this.props.junoClient.getNotebookContentUrl(data.id), data, isFavorite);
    } else {
      const params = new URLSearchParams({
        [GalleryUtils.NotebookViewerParams.NotebookUrl]: this.props.junoClient.getNotebookContentUrl(data.id),
        [GalleryUtils.NotebookViewerParams.GalleryItemId]: data.id
      });

      window.open(`/notebookViewer.html?${params.toString()}`);
    }
  };

  private loadTaggedItems = (tag: string): void => {
    const searchText = tag;
    this.setState({
      searchText
    });

    this.loadTabContent(this.state.selectedTab, searchText, this.state.sortBy, true);
    this.props.onSearchTextChange && this.props.onSearchTextChange(searchText);
  };

  private favoriteItem = async (data: IGalleryItem): Promise<void> => {
    GalleryUtils.favoriteItem(this.props.container, this.props.junoClient, data, (item: IGalleryItem) => {
      if (this.favoriteNotebooks) {
        this.favoriteNotebooks.push(item);
      } else {
        this.favoriteNotebooks = [item];
      }
      this.refreshSelectedTab(item);
    });
  };

  private unfavoriteItem = async (data: IGalleryItem): Promise<void> => {
    GalleryUtils.unfavoriteItem(this.props.container, this.props.junoClient, data, (item: IGalleryItem) => {
      this.favoriteNotebooks = this.favoriteNotebooks?.filter(value => value.id !== item.id);
      this.refreshSelectedTab(item);
    });
  };

  private downloadItem = async (data: IGalleryItem): Promise<void> => {
    GalleryUtils.downloadItem(this, this.props.container, this.props.junoClient, data, item =>
      this.refreshSelectedTab(item)
    );
  };

  private deleteItem = async (data: IGalleryItem): Promise<void> => {
    GalleryUtils.deleteItem(this.props.container, this.props.junoClient, data, item => {
      this.publishedNotebooks = this.publishedNotebooks.filter(notebook => item.id !== notebook.id);
      this.refreshSelectedTab(item);
    });
  };

  private onPivotChange = (item: PivotItem): void => {
    const selectedTab = GalleryTab[item.props.itemKey as keyof typeof GalleryTab];
    const searchText: string = undefined;
    this.setState({
      selectedTab,
      searchText
    });

    this.loadTabContent(selectedTab, searchText, this.state.sortBy, false);
    this.props.onSelectedTabChange && this.props.onSelectedTabChange(selectedTab);
  };

  private onSearchBoxChange = (event?: React.ChangeEvent<HTMLInputElement>, newValue?: string): void => {
    const searchText = newValue;
    this.setState({
      searchText
    });

    this.loadTabContent(this.state.selectedTab, searchText, this.state.sortBy, true);
    this.props.onSearchTextChange && this.props.onSearchTextChange(searchText);
  };

  private onDropdownChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    const sortBy = option.key as SortBy;
    this.setState({
      sortBy
    });

    this.loadTabContent(this.state.selectedTab, this.state.searchText, sortBy, true);
    this.props.onSortByChange && this.props.onSortByChange(sortBy);
  };
}