/* ==========================================================================
 * uml_event_queue.h - Event Queue (Circular Ring Buffer FIFO)
 * Bagian dari UML-to-C Runtime Library
 * ========================================================================== */
#ifndef UML_EVENT_QUEUE_H
#define UML_EVENT_QUEUE_H

#include "uml_port.h"
#include "uml_types.h"
#include <string.h>

/* --------------------------------------------------------------------------
 * Konfigurasi (dapat di-override sebelum #include)
 * -------------------------------------------------------------------------- */
#ifndef UML_EVENT_QUEUE_CAPACITY
#define UML_EVENT_QUEUE_CAPACITY 32
#endif

#ifndef UML_EVENT_MAX_PAYLOAD
#define UML_EVENT_MAX_PAYLOAD 32
#endif

/* --------------------------------------------------------------------------
 * Struktur Event
 * -------------------------------------------------------------------------- */
typedef struct {
  void *target;      /* Pointer ke instans target */
  uint16_t class_id; /* ID kelas target */
  uint16_t event_id; /* ID event */
  uint8_t payload_size;
  uint8_t payload[UML_EVENT_MAX_PAYLOAD]; /* Data payload event */
} UML_Event_t;

/* --------------------------------------------------------------------------
 * Struktur Event Queue
 * -------------------------------------------------------------------------- */
typedef struct {
  UML_Event_t buffer[UML_EVENT_QUEUE_CAPACITY];
  uint16_t head;
  uint16_t tail;
  uint16_t count;
} UML_EventQueue_t;

/* --------------------------------------------------------------------------
 * API Event Queue
 * -------------------------------------------------------------------------- */

static inline void UML_EventQueue_init(UML_EventQueue_t *q) {
  if (q == NULL)
    return;
  q->head = 0;
  q->tail = 0;
  q->count = 0;
  memset(q->buffer, 0, sizeof(q->buffer));
}

static inline bool UML_EventQueue_is_empty(const UML_EventQueue_t *q) {
  return (q == NULL || q->count == 0);
}

static inline bool UML_EventQueue_is_full(const UML_EventQueue_t *q) {
  return (q != NULL && q->count >= UML_EVENT_QUEUE_CAPACITY);
}

static inline bool UML_EventQueue_post(UML_EventQueue_t *q, void *target,
                                       uint16_t class_id, uint16_t event_id,
                                       const void *payload,
                                       uint8_t payload_size) {
  if (q == NULL)
    return false;
  if (UML_EventQueue_is_full(q)) {
    UML_ERROR_HOOK(UML_ERR_QUEUE_FULL, "Event queue full");
    return false;
  }
  if (payload_size > UML_EVENT_MAX_PAYLOAD) {
    payload_size = UML_EVENT_MAX_PAYLOAD;
  }

  UML_Event_t *evt = &q->buffer[q->tail];
  evt->target = target;
  evt->class_id = class_id;
  evt->event_id = event_id;
  evt->payload_size = payload_size;
  if (payload != NULL && payload_size > 0) {
    memcpy(evt->payload, payload, payload_size);
  } else {
    evt->payload_size = 0;
  }

  q->tail = (uint16_t)((q->tail + 1) % UML_EVENT_QUEUE_CAPACITY);
  q->count++;
  return true;
}

static inline bool UML_EventQueue_get(UML_EventQueue_t *q, UML_Event_t *out) {
  if (q == NULL || out == NULL || UML_EventQueue_is_empty(q)) {
    return false;
  }

  *out = q->buffer[q->head];
  q->head = (uint16_t)((q->head + 1) % UML_EVENT_QUEUE_CAPACITY);
  q->count--;
  return true;
}

static inline uint16_t UML_EventQueue_count(const UML_EventQueue_t *q) {
  return (q != NULL) ? q->count : 0;
}

/* --------------------------------------------------------------------------
 * Global Event Queue (singleton utama untuk satu domain)
 * -------------------------------------------------------------------------- */
extern UML_EventQueue_t g_uml_event_queue;

/* --------------------------------------------------------------------------
 * Event Dispatcher: diimplementasikan oleh kode yang digenerate (domain.c)
 *   Fungsi ini di-resolve oleh domain code yang menyediakan switch(class_id).
 * -------------------------------------------------------------------------- */
typedef bool (*UML_DispatchFn_t)(void *target, uint16_t event_id,
                                 const void *payload, uint8_t payload_size);

/* --------------------------------------------------------------------------
 * Main Event Loop (dipanggil oleh main.c)
 *   Memproses seluruh event di queue hingga kosong.
 * -------------------------------------------------------------------------- */
static inline uint32_t UML_EventLoop_run(UML_EventQueue_t *q,
                                         UML_DispatchFn_t dispatch_fn) {
  uint32_t processed = 0;
  UML_Event_t evt;

  while (UML_EventQueue_get(q, &evt)) {
    if (evt.target != NULL && dispatch_fn != NULL) {
      dispatch_fn(evt.target, evt.event_id, evt.payload, evt.payload_size);
    }
    processed++;
  }
  return processed;
}

#endif /* UML_EVENT_QUEUE_H */
