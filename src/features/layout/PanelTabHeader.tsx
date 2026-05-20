import React, { useCallback, useMemo, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview';
import { MoreHorizontal, Plus, Settings2, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { cn } from '@/shared/lib/utils';
import type { PanelType } from '../panels/framework';
import { getPanelTypeFromId, listPanelStates, usePanelActions } from '../panels/framework';
import { PANEL_TYPE_MESSAGE_SLUG } from '../panels/framework/panelMessageSlug';
import { PanelTypeIcon } from '../panels/framework/panelIcons';
import {
  buildXenseTabContextMenuItems,
  XenseTabContextMenuPortal,
} from './xenseTabContextMenu';
import { WELCOME_PANEL_ID } from './dockviewIds';
import { openDockviewPanel } from './dockviewController';
import { getFoxgloveAdapter, getPanelDefinition, getPanelDefinitions, hasFoxgloveAdapter, hasPanelDefinition } from '../panels/registry';
import {
  PanelTabAddPanelDefinitionsSubmenus,
  panelTabDropdownIconRowClass,
} from './PanelTabAddPanelDefinitionsSubmenus';

/** Tab label uses localized panel titles (`panels.<slug>.defaultTitle`). */
function resolveTabDefaultTitle(panelId: string, dockviewTitle: string): string {
  const snapshot = listPanelStates()[panelId];
  if (snapshot?.type && hasPanelDefinition(snapshot.type)) {
    return getPanelDefinition(snapshot.type).defaultTitle;
  }
  const prefix = getPanelTypeFromId(panelId);
  if (hasPanelDefinition(prefix)) {
    return getPanelDefinition(prefix).defaultTitle;
  }
  if (hasFoxgloveAdapter(prefix)) {
    return getPanelDefinition(getFoxgloveAdapter(prefix).internalType).defaultTitle;
  }
  return dockviewTitle;
}

/** Resolves the PanelType for a panel id, returns null for unknown/welcome panels. */
function resolveTabPanelType(panelId: string): PanelType | null {
  const snapshot = listPanelStates()[panelId];
  if (snapshot?.type && hasPanelDefinition(snapshot.type)) {
    return snapshot.type;
  }
  const prefix = getPanelTypeFromId(panelId);
  if (hasPanelDefinition(prefix)) {
    return prefix;
  }
  if (hasFoxgloveAdapter(prefix)) {
    return getFoxgloveAdapter(prefix).internalType;
  }
  return null;
}

const addPanelMenuContentClassName = 'max-h-[min(24rem,70vh)] overflow-y-auto';

const tabIconButtonClassName = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'ros-dockview-tab-action h-8 w-8 shrink-0 font-normal focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 ring-offset-background [&_svg]:size-3.5',
);

export const PanelTabHeader: React.FC<IDockviewPanelHeaderProps> = ({ api, containerApi }) => {
  const { formatMessage } = useIntl();
  const panel = containerApi.getPanel(api.id);
  const dockviewTitle = panel?.title ?? api.title ?? 'Panel';
  const panelType = resolveTabPanelType(api.id);
  const defaultTitleFallback = resolveTabDefaultTitle(api.id, dockviewTitle);
  const title = useMemo(() => {
    if (panelType != null && hasPanelDefinition(panelType)) {
      const slug = PANEL_TYPE_MESSAGE_SLUG[panelType];
      return formatMessage({ id: `panels.${slug}.defaultTitle`, defaultMessage: defaultTitleFallback });
    }
    return defaultTitleFallback;
  }, [formatMessage, panelType, defaultTitleFallback]);
  const actions = usePanelActions(api.id);
  const isWelcome = api.id === WELCOME_PANEL_ID;
  const isCompactTabActions = (panel?.group.panels.length ?? 0) > 1;
  const definitions = useMemo(
    () => getPanelDefinitions().filter((d) => d.type !== 'Unavailable'),
    [],
  );
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [ctxItems, setCtxItems] = useState<ReturnType<typeof buildXenseTabContextMenuItems>>([]);

  const onTabContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setCtxItems(
        buildXenseTabContextMenuItems({
          containerApi,
          panelApi: api,
          welcomePanelId: WELCOME_PANEL_ID,
        }),
      );
      setCtx({ x: event.clientX, y: event.clientY });
    },
    [api, containerApi],
  );

  const closePanel = useCallback(() => {
    containerApi.getPanel(api.id)?.api.close();
  }, [api.id, containerApi]);

  const addPanelWithPlacement = useCallback(
    (type: PanelType, placement: 'replace' | 'right' | 'below' | 'within') => {
      if (placement === 'replace') {
        openDockviewPanel({
          type,
          position: { referencePanel: api.id, direction: 'within' },
        });
        window.setTimeout(() => {
          containerApi.getPanel(api.id)?.api.close();
        }, 0);
        return;
      }
      openDockviewPanel({
        type,
        position: { referencePanel: api.id, direction: placement },
      });
    },
    [api.id, containerApi],
  );

  const openSettings = useCallback(() => {
    containerApi.getPanel(api.id)?.api.setActive();
    actions?.openSettingsSidebar();
  }, [actions, api.id, containerApi]);

  const addPanelSubmenus = (
    <PanelTabAddPanelDefinitionsSubmenus
      definitions={definitions}
      formatMessage={formatMessage}
      onPlacement={addPanelWithPlacement}
    />
  );

  return (
    <div
      className="xense-dockview-tab-row flex items-center w-full min-w-0 h-full gap-1 px-2 box-border"
      onContextMenu={onTabContextMenu}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {panelType && !isWelcome && (
          <PanelTypeIcon type={panelType} className="h-3 w-3 shrink-0 opacity-60" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm" title={title}>
          {title}
        </span>
      </div>

      {!isWelcome && (
        <>
          <Separator orientation="vertical" className="mx-0.5 h-4 shrink-0 self-center" decorative />
          <div
            className="flex shrink-0 items-center gap-0.5"
            data-testid="panel-tab-actions"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            {isCompactTabActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={tabIconButtonClassName}
                    title={formatMessage({ id: 'layout.panelTab.moreTitle' })}
                    aria-label={formatMessage({ id: 'layout.panelTab.moreAria' })}
                    data-testid="panel-tab-more-button"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={addPanelMenuContentClassName}
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions?.hasSettings && (
                    <DropdownMenuItem
                      className={panelTabDropdownIconRowClass}
                      data-testid="panel-tab-settings-button"
                      onSelect={() => {
                        openSettings();
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      {formatMessage({ id: 'layout.panelTab.openSettings' })}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <Plus className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      {formatMessage({ id: 'layout.panelTab.addPanelSubmenu' })}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className={addPanelMenuContentClassName}>
                      {addPanelSubmenus}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    className={cn(panelTabDropdownIconRowClass, 'text-destructive focus:bg-destructive/10 focus:text-destructive')}
                    data-testid="panel-tab-close-button"
                    onSelect={() => {
                      closePanel();
                    }}
                  >
                    <X className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {formatMessage({ id: 'layout.panelTab.closePanel' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                {actions?.hasSettings && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={tabIconButtonClassName}
                    title={formatMessage({ id: 'layout.panelTab.openSettingsTitle' })}
                    aria-label={formatMessage({ id: 'layout.panelTab.openSettingsAria' })}
                    data-testid="panel-tab-settings-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      openSettings();
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={tabIconButtonClassName}
                      title={formatMessage({ id: 'layout.panelTab.addPanelTitle' })}
                      aria-label={formatMessage({ id: 'layout.panelTab.addPanelAria' })}
                      data-testid="panel-tab-add-button"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={addPanelMenuContentClassName}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {addPanelSubmenus}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={tabIconButtonClassName}
                  title={formatMessage({ id: 'layout.panelTab.closePanelTitle' })}
                  aria-label={formatMessage({ id: 'layout.panelTab.closePanelAria' })}
                  data-testid="panel-tab-close-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    closePanel();
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <XenseTabContextMenuPortal anchor={ctx} items={ctxItems} onRequestClose={() => setCtx(null)} />
    </div>
  );
};
