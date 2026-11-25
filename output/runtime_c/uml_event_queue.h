/* ==========================================================================
 * uml_event_queue.h - Event Queue (Circular Ring Buffer FIFO)
 * Bagian dari UML-to-C Runtime Library
 * ========================================================================== */
#ifndef UML_EVENT_QUEUE_H
#define UML_EVENT_QUEUE_H

#include "uml_port.h"
#include "uml_types.h"
#include <string.h>

#ifndef UML_EVENT_QUEUE_CAPACITY
#define UML_EVENT_QUEUE_CAPACITY 32
#endif

#ifndef UML_EVENT_MAX_PAYLOAD
#define UML_EVENT_MAX_PAYLOAD 32
#endif

typedef struct {
    void *target;
    uint16_t class_id;
    uint16_t event_id;
    uint8_t payload_size;
    uint8_t payload[UML_EVENT_MAX_PAYLOAD];
} UML_Event_t;

typedef struct {
    UML_Event_t buffer[UML_EVENT_QUEUE_CAPACITY];
    uint16_t head;
    uint16_t tail;
    uint16_t count;
} UML_EventQueue_t;

static inline void UML_EventQueue_init(UML_EventQueue_t *q) {
    if (q == NULL) return;
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

#endif /* UML_EVENT_QUEUE_H */
