import { memo } from 'react';
import { css } from '@linaria/core';

import { useRovingTabIndex } from './hooks';
import { createCellEvent, getCellClassname, getCellStyle, isCellEditableUtil } from './utils';
import type { CellRendererProps, GridSelection, TSelection } from './types';

const loading = css`
  animation:
    skeleton-fade-in 0.3s linear forwards,
    skeleton-glow 1s linear infinite alternate;
  animation-delay: 0s, 0.3s;
  height: 5px;
  background-clip: padding-box !important;
  border-color: rgba(206, 217, 224, 0.2) !important;
  border-radius: 4px;
  box-shadow: none !important;
  color: transparent !important;
  width: calc(100% - 32px);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  @keyframes skeleton-fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes skeleton-glow {
    0% {
      background: rgba(206, 217, 224, 0.2);
      border-color: rgba(206, 217, 224, 0.2);
    }
    100% {
      background: rgba(92, 112, 128, 0.2);
      border-color: rgba(92, 112, 128, 0.2);
    }
  }
`;

const cellCopied = css`
  @layer rdg.Cell {
    background-color: #ccccff;
  }
`;

//const cellCopiedClassname = `rdg-cell-copied ${cellCopied}`;

const cellSelected = css`
  background-color: var(--rdg-cell-selected-color) !important;
`;

const cellSelectedClassname = `rdg-cell-selected ${cellSelected}`;

const cellDraggedOver = css`
  @layer rdg.Cell {
    background-color: #ccccff;

    &.${cellCopied} {
      background-color: #9999ff;
    }
  }
`;

const cellDraggedOverClassname = `rdg-cell-dragged-over ${cellDraggedOver}`;

const cellLoading = css`
  /* Hide the text. */
  text-align: initial !important;
  text-indent: -99999px;
`;

const cellLoadingClassname = `rdg-cell-loading ${cellLoading}`;

const rowHeader = css`
  background-color: var(--header-background-color);
  font-weight: bold;
  cursor: e-resize;
  text-align: right !important;
  padding-left: 38px;
`;
const rowHeaderClassname = `rdg-cell-row-header ${rowHeader}`;

function Cell<R, SR>({
  cellStyles,
  column,
  colSpan,
  isCellFocused,
  isCellSelected,
  isCopied,
  isDraggedOver,
  row,
  rowIdx,
  onClick,
  onDoubleClick,
  onContextMenu,
  onRowChange,
  selectCell,
  dragPos,
  updateDraggedOverRange,
  ...props
}: CellRendererProps<R, SR>) {
  const { tabIndex, childTabIndex, onFocus } = useRovingTabIndex(isCellFocused);

  const { cellClass } = column;
  const className = getCellClassname(
    column,
    {
      //[cellCopiedClassname]: isCopied,
      [cellDraggedOverClassname]: isDraggedOver && !isCellFocused,
      [cellSelectedClassname]: isCellSelected,
      [cellLoadingClassname]: cellStyles?.loading,
      [rowHeaderClassname]: column.idx === 0
    },
    typeof cellClass === 'function' ? cellClass(row) : cellClass,
    cellStyles?.classes
  );
  const isEditable = isCellEditableUtil(column, row);

  function selectCellWrapper(openEditor?: boolean) {
    selectCell({ rowIdx, idx: column.idx }, openEditor);
  }

  function handleClick(event?: React.MouseEvent<HTMLDivElement>) {
    if (onClick && event) {
      const cellEvent = createCellEvent(event);
      onClick({ row, column, selectCell: selectCellWrapper }, cellEvent);
      if (cellEvent.isGridDefaultPrevented()) return;
    } else selectCellWrapper();
    selectCellWrapper();
  }

  function handleMouseEnter() {
    if (
      dragPos.current?.column &&
      dragPos.current.startRowIdx >= 0 &&
      dragPos.current.startIdx >= 0
    )
      dragPos.current = { ...dragPos.current, lastRowIdx: rowIdx, lastIdx: column.idx };
    updateDraggedOverRange();
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const { idx } = column;
    const eventTarget = event.target as HTMLElement;
    let selType: TSelection = 'SELECT';
    if (eventTarget.id === 'rdg-drag-handle') selType = 'DRAG';
    else if (eventTarget.id === 'rdg-reorder-handle') selType = 'REORDER';
    updateDraggedOverRange();
    handleClick();
    dragPos.current = {
      startRowIdx: rowIdx,
      startIdx: idx,
      selType,
      column
    };

    window.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseup', onMouseUp);

    function onMouseOver(event: MouseEvent) {
      // Trigger onMouseup in edge cases where we release the mouse button but `mouseup` isn't triggered,
      // for example when releasing the mouse button outside the iframe the grid is rendered in.
      // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
      if (event.buttons !== 1) onMouseUp();
    }

    function onMouseUp() {
      window.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseup', onMouseUp);

      if (!dragPos.current) return;

      let { startRowIdx, startIdx, lastRowIdx, lastIdx, selType } = dragPos.current;
      lastIdx ||= startIdx;
      lastRowIdx ||= startRowIdx;

      const dragType =
        Math.abs(lastIdx - startIdx) > Math.abs(lastRowIdx - startRowIdx) ? 'col' : 'row';

      const sel: GridSelection = {
        rowStart:
          dragType === 'row' || selType !== 'DRAG'
            ? Math.min(lastRowIdx, startRowIdx)
            : startRowIdx,
        rowEnd:
          dragType === 'row' || selType !== 'DRAG'
            ? Math.max(lastRowIdx, startRowIdx)
            : startRowIdx,
        colStart: dragType === 'col' || selType !== 'DRAG' ? Math.min(lastIdx, startIdx) : startIdx,
        colEnd: dragType === 'col' || selType !== 'DRAG' ? Math.max(lastIdx, startIdx) : startIdx
      };

      /*if (updateScrollInterval.current) {
        clearInterval(updateScrollInterval.current);
        updateScrollInterval.current = undefined;
        progScroll.current = { top: 1, bottom: 1, left: 1, right: 1 };
      }*/
      dragPos.current = undefined;
      selectCell({ rowIdx: startRowIdx, idx: startIdx, sel });

      handleClick();
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (onContextMenu) {
      const cellEvent = createCellEvent(event);
      onContextMenu({ row, column, selectCell: selectCellWrapper }, cellEvent);
      if (cellEvent.isGridDefaultPrevented()) return;
    }
    selectCellWrapper();
  }

  /*function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (onDoubleClick) {
      const cellEvent = createCellEvent(event);
      onDoubleClick({ row, column, selectCell: selectCellWrapper }, cellEvent);
      if (cellEvent.isGridDefaultPrevented()) return;
    }
    selectCellWrapper(true);
  }*/

  function handleRowChange(newRow: R) {
    onRowChange(column, newRow);
  }

  return (
    <div
      role="gridcell"
      aria-colindex={column.idx + 1} // aria-colindex is 1-based
      aria-colspan={colSpan}
      aria-selected={isCellFocused}
      aria-readonly={!isEditable || undefined}
      tabIndex={tabIndex}
      className={className}
      style={getCellStyle(column, colSpan, cellStyles)}
      //onClick={handleClick}
      //onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onFocus={onFocus}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {column.renderCell({
        column,
        row,
        rowIdx,
        isCellEditable: isEditable,
        tabIndex: childTabIndex,
        onRowChange: handleRowChange
      })}

      {cellStyles?.loading && <div className={loading} />}
    </div>
  );
}

export default memo(Cell) as <R, SR>(props: CellRendererProps<R, SR>) => JSX.Element;
