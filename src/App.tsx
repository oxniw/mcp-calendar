import { useState, useEffect } from "react";
import { getEvents, saveEvent, deleteEvent, CalendarEvent, getMcpConfig } from "./tauriClient";
import "./App.css";

// Helper constants
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const CATEGORIES: CalendarEvent["category"][] = ["work", "personal", "important", "other"];

interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function App() {
  // Calendar View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Modal / Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formCategory, setFormCategory] = useState<CalendarEvent["category"]>("work");

  // Import / Copy State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceDate, setCopySourceDate] = useState("");



  // Load events from Rust backend on startup
  useEffect(() => {
    loadAllEvents();
  }, []);

  async function loadAllEvents() {
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      console.error("Failed to load events", err);
    }
  }

  // Handle month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Helper: format dates locally
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate days for 6-week month grid
  const getGridDays = (): DayInfo[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const gridDays: DayInfo[] = [];
    const today = new Date();

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, daysInPrevMonth - i);
      gridDays.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: isSameDay(dayDate, today),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      gridDays.push({
        date: dayDate,
        isCurrentMonth: true,
        isToday: isSameDay(dayDate, today),
      });
    }

    // Next month padding days to fill 42 cells (6 rows * 7 days)
    const remainingCells = 42 - gridDays.length;
    for (let i = 1; i <= remainingCells; i++) {
      const dayDate = new Date(year, month + 1, i);
      gridDays.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: isSameDay(dayDate, today),
      });
    }

    return gridDays;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Open creation modal
  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDesc("");
    setFormDate(formatDateString(selectedDate));
    setFormStart("09:00");
    setFormEnd("10:00");
    setFormCategory("work");
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the day under the event pill
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDesc(event.description);
    
    // Parse ISO dates back to form inputs
    const startObj = new Date(event.startTime);
    setFormDate(formatDateString(startObj));
    setFormStart(
      `${String(startObj.getHours()).padStart(2, "0")}:${String(startObj.getMinutes()).padStart(2, "0")}`
    );
    
    const endObj = new Date(event.endTime);
    setFormEnd(
      `${String(endObj.getHours()).padStart(2, "0")}:${String(endObj.getMinutes()).padStart(2, "0")}`
    );
    
    setFormCategory(event.category);
    setIsModalOpen(true);
  };

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    // Create ISO string for start and end times
    const startTimeISO = new Date(`${formDate}T${formStart}:00`).toISOString();
    const endTimeISO = new Date(`${formDate}T${formEnd}:00`).toISOString();

    const eventToSave: CalendarEvent = {
      id: editingEvent ? editingEvent.id : crypto.randomUUID(),
      title: formTitle.trim(),
      description: formDesc.trim(),
      startTime: startTimeISO,
      endTime: endTimeISO,
      category: formCategory,
    };

    try {
      await saveEvent(eventToSave);
      await loadAllEvents();
      setIsModalOpen(false);
    } catch (err) {
      alert("Failed to save event");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!editingEvent) return;
    if (confirm("Are you sure you want to delete this event?")) {
      try {
        await deleteEvent(editingEvent.id);
        await loadAllEvents();
        setIsModalOpen(false);
      } catch (err) {
        alert("Failed to delete event");
      }
    }
  };

  // Shifts an event date/time to align with the target date, preserving original duration and time-of-day
  const shiftEventDate = (event: CalendarEvent, targetDate: Date): CalendarEvent => {
    const origStart = new Date(event.startTime);
    const origEnd = new Date(event.endTime);
    const duration = origEnd.getTime() - origStart.getTime();

    // Create a new start date targeting the selected date, retaining original hours and minutes
    const newStart = new Date(targetDate);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);

    // End time is start time + original duration
    const newEnd = new Date(newStart.getTime() + duration);

    return {
      ...event,
      id: crypto.randomUUID(), // Assign a fresh unique ID
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    };
  };

  // Copies all events from a source date to the currently selected date
  const handleCopyFromDate = async (sourceDateStr: string) => {
    if (!sourceDateStr) return;
    const sourceDate = new Date(sourceDateStr);

    const sourceEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, sourceDate);
    });

    if (sourceEvents.length === 0) {
      alert("No events found on the selected source date to copy.");
      return;
    }

    try {
      for (const event of sourceEvents) {
        const shifted = shiftEventDate(event, selectedDate);
        await saveEvent(shifted);
      }
      await loadAllEvents();
      setIsCopyModalOpen(false);
    } catch (err) {
      alert("Failed to copy events");
    }
  };

  // Reads a JSON file, parses it, shifts events to the selected date, and saves them
  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const contents = event.target?.result as string;
      try {
        const parsed = JSON.parse(contents);
        const importedList: CalendarEvent[] = Array.isArray(parsed) ? parsed : [parsed];

        // Basic schema verification
        const validEvents = importedList.filter(evt => {
          return evt && typeof evt.title === "string" && typeof evt.startTime === "string" && typeof evt.endTime === "string";
        });

        if (validEvents.length === 0) {
          alert("The uploaded file does not contain any valid calendar events.");
          return;
        }

        for (const evt of validEvents) {
          const shifted = shiftEventDate(evt, selectedDate);
          await saveEvent(shifted);
        }

        await loadAllEvents();
        alert(`Successfully imported ${validEvents.length} events onto the selected date.`);
      } catch (err) {
        alert("Failed to parse JSON file. Please ensure it is a valid events JSON format.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  // Handles copying the dynamically resolved MCP Server JSON configuration to the clipboard
  const handleCopyMcpConfig = async () => {
    try {
      const configStr = await getMcpConfig();
      await navigator.clipboard.writeText(configStr);
      alert("MCP Server configuration JSON copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy MCP config: ", err);
      alert("Failed to copy configuration. Make sure you compile the application first.");
    }
  };

  // Triggers click on the hidden file input
  const triggerFileInput = () => {
    document.getElementById("import-file-input")?.click();
  };

  // Filter events for the currently selected day
  const getSelectedDayEvents = (): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, selectedDate);
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Filter events for specific grid cells
  const getCellEvents = (cellDate: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, cellDate);
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Formatting helpers for UI
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const gridDays = getGridDays();
  const selectedDayEvents = getSelectedDayEvents();

  return (
    <div className="app-container">
      {/* Sidebar - Today's events and action */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>{selectedDate.toLocaleDateString([], { weekday: 'long' })}</h2>
          <p>{selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="action-button-container">
          <button 
            className="btn-primary main-action-btn" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Schedule Actions
          </button>
          
          <input 
            type="file" 
            id="import-file-input" 
            style={{ display: "none" }} 
            accept=".json"
            onChange={handleImportFromFile}
          />

          {isDropdownOpen && (
            <div className="action-dropdown" onMouseLeave={() => setIsDropdownOpen(false)}>
              <div 
                className="dropdown-item" 
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleOpenCreateModal();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create New Event
              </div>
              <div 
                className="dropdown-item" 
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsCopyModalOpen(true);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy from another day
              </div>
              <div 
                className="dropdown-item" 
                onClick={() => {
                  setIsDropdownOpen(false);
                  triggerFileInput();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Import from file
              </div>
              <div 
                className="dropdown-item" 
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleCopyMcpConfig();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy json mcp server
              </div>
            </div>
          )}
        </div>

        <div className="events-list-container">
          <h3 className="events-list-title">Events on this day</h3>
          <div className="events-scroll">
            {selectedDayEvents.length === 0 ? (
              <div className="empty-state">
                <p>No events scheduled</p>
              </div>
            ) : (
              selectedDayEvents.map(event => (
                <div 
                  key={event.id} 
                  className={`event-card ${event.category}`}
                  onClick={(e) => handleOpenEditModal(event, e)}
                >
                  <div className="event-card-header">
                    <span className="event-card-title">{event.title}</span>
                    <span className="event-card-time">
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </span>
                  </div>
                  {event.description && (
                    <p className="event-card-desc">{event.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Area - Calendar Grid */}
      <main className="main-content">
        <header className="calendar-header">
          <div className="calendar-title-container">
            <h1 className="calendar-title">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h1>
            <div className="nav-buttons">
              <button className="btn-icon" onClick={prevMonth} title="Previous Month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button className="btn-icon" onClick={nextMonth} title="Next Month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>
          <button className="btn-secondary" onClick={setToday}>
            Today
          </button>
        </header>

        <div className="calendar-view-container">
          <div className="weekdays-grid">
            {WEEKDAYS.map(day => (
              <div key={day} className="weekday-label">{day}</div>
            ))}
          </div>
          <div className="days-grid">
            {gridDays.map((dayInfo, index) => {
              const cellEvents = getCellEvents(dayInfo.date);
              const isSelected = isSameDay(dayInfo.date, selectedDate);
              
              return (
                <div 
                  key={index} 
                  className={`day-cell ${dayInfo.isCurrentMonth ? "" : "outside"} ${isSelected ? "selected" : ""} ${dayInfo.isToday ? "today" : ""}`}
                  onClick={() => setSelectedDate(dayInfo.date)}
                >
                  <div className="day-number-container">
                    <span className="day-number">{dayInfo.date.getDate()}</span>
                  </div>
                  <div className="day-events-container">
                    {cellEvents.slice(0, 3).map(event => (
                      <div 
                        key={event.id} 
                        className={`day-event-pill ${event.category}`}
                        onClick={(e) => handleOpenEditModal(event, e)}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {cellEvents.length > 3 && (
                      <div className="day-event-pill other" style={{ textAlign: 'center', opacity: 0.8 }}>
                        + {cellEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modal - Create/Edit Event Form */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEvent ? "Edit Event" : "Create Event"}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="evt-title">Title</label>
                <input 
                  id="evt-title"
                  type="text" 
                  className="form-control" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Event title"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="evt-desc">Description</label>
                <textarea 
                  id="evt-desc"
                  className="form-control" 
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Add description"
                />
              </div>
              <div className="form-group">
                <label htmlFor="evt-date">Date</label>
                <input 
                  id="evt-date"
                  type="date" 
                  className="form-control" 
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="evt-start">Start Time</label>
                  <input 
                    id="evt-start"
                    type="time" 
                    className="form-control" 
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="evt-end">End Time</label>
                  <input 
                    id="evt-end"
                    type="time" 
                    className="form-control" 
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <div className="category-select-container">
                  {CATEGORIES.map(cat => (
                    <div 
                      key={cat}
                      className={`category-option ${cat} ${formCategory === cat ? "selected" : ""}`}
                      onClick={() => setFormCategory(cat)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                {editingEvent && (
                  <button type="button" className="btn-danger" onClick={handleDelete}>
                    Delete
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ margin: 0 }}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Copy Schedule from Another Day */}
      {isCopyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCopyModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Copy Schedule from Day</h3>
              <button className="btn-icon" onClick={() => setIsCopyModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCopyFromDate(copySourceDate); }}>
              <div className="form-group">
                <label htmlFor="copy-source-date">Select Source Date</label>
                <input 
                  id="copy-source-date"
                  type="date" 
                  className="form-control" 
                  value={copySourceDate}
                  onChange={(e) => setCopySourceDate(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                This will copy all events from the selected date and shift them to start on your currently selected date: <strong>{selectedDate.toLocaleDateString()}</strong>.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCopyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ margin: 0 }}>
                  Copy Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}

export default App;
