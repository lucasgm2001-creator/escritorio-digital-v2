'use client'

import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface TabConfig {
  key: string
  label: string
}

interface DraggableTabsProps {
  tabs: TabConfig[]
  activeTab: string
  onTabChange: (key: string) => void
  sectionKey: string
}

function SortableTab({ tab, isActive, onTabChange }: { tab: TabConfig; isActive: boolean; onTabChange: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onTabChange}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing ${
        isActive
          ? 'border-primary-600 text-primary-400'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {tab.label}
    </button>
  )
}

export function DraggableTabs({ tabs, activeTab, onTabChange, sectionKey }: DraggableTabsProps) {
  const [tabOrder, setTabOrder] = useState<string[]>(tabs.map(t => t.key))
  const [orderedTabs, setOrderedTabs] = useState<TabConfig[]>(tabs)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(`dashboard-tabs-order-${sectionKey}`)
      if (savedOrder) {
        const order = JSON.parse(savedOrder) as string[]
        if (order.length === tabs.length && order.every(k => tabs.some(t => t.key === k))) {
          setTabOrder(order)
          const ordered = order.map(key => tabs.find(t => t.key === key)!).filter(Boolean)
          setOrderedTabs(ordered)
        }
      }
    } catch (error) {
      console.error(`Failed to load tab order for ${sectionKey}:`, error)
    }
  }, [sectionKey, tabs])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = tabOrder.indexOf(active.id as string)
    const overIndex = tabOrder.indexOf(over.id as string)

    const newOrder = Array.from(tabOrder)
    newOrder.splice(activeIndex, 1)
    newOrder.splice(overIndex, 0, active.id as string)

    setTabOrder(newOrder)
    const ordered = newOrder.map(key => tabs.find(t => t.key === key)!).filter(Boolean)
    setOrderedTabs(ordered)

    try {
      localStorage.setItem(`dashboard-tabs-order-${sectionKey}`, JSON.stringify(newOrder))
    } catch (error) {
      console.error(`Failed to save tab order for ${sectionKey}:`, error)
    }
  }

  const handleResetOrder = () => {
    const defaultOrder = tabs.map(t => t.key)
    setTabOrder(defaultOrder)
    setOrderedTabs(tabs)
    try {
      localStorage.removeItem(`dashboard-tabs-order-${sectionKey}`)
    } catch (error) {
      console.error(`Failed to reset tab order for ${sectionKey}:`, error)
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-[#2d3748]">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-0 flex-1 overflow-x-auto">
            {orderedTabs.map(tab => (
              <SortableTab
                key={tab.key}
                tab={tab}
                isActive={activeTab === tab.key}
                onTabChange={() => onTabChange(tab.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {tabOrder.length > 0 && (
        <button
          onClick={handleResetOrder}
          className="ml-2 px-2 py-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Resetar ordem das abas"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  )
}
