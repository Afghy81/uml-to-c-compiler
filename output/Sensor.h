#ifndef SENSOR_H
#define SENSOR_H

#include "runtime_c/uml_types.h"
#include "runtime_c/uml_pool.h"
#include "runtime_c/uml_event_queue.h"


/* ====================================================================== */
/*                        Sensor Class Interface                        */
/* ====================================================================== */

typedef struct Sensor_s Sensor_t;
typedef Sensor_t Sensor;

typedef struct Controller_s Controller_t;
typedef Controller_t Controller;

// State enumeration
typedef enum {
    SENSOR_STATE_IDLE = 0,
    SENSOR_STATE_SAMPLING = 1,
    SENSOR_STATE_OVERHEATALERT = 2,
} Sensor_State;

// Event enumeration
typedef enum {
    SENSOR_EVENT_STARTSAMPLING = 1,
    SENSOR_EVENT_SAMPLEOK = 2,
    SENSOR_EVENT_OVERHEAT = 3,
    SENSOR_EVENT_RESET = 4,
} Sensor_Event;

// Sensor structure
struct Sensor_s {
    UML_InstanceHeader_t header;
    float suhu;
    Controller_t* controller;
    Sensor_State current_state;
};

// Lifecycle functions
void Sensor_init(Sensor_t* self);
Sensor_t* Sensor_create(void);
void Sensor_destroy(Sensor_t* self);

float Sensor_get_suhu(const Sensor_t* self);
void Sensor_set_suhu(Sensor_t* self, float value);

// Relationship link helpers
void Sensor_relate_R1(Sensor_t* self, Controller_t* target);
void Sensor_unrelate_R1(Sensor_t* self);
Controller_t* Sensor_get_controller(const Sensor_t* self);
void Sensor_set_controller(Sensor_t* self, Controller_t* target);

// Methods (Operations with explicit self pointer)
void Sensor_bacaData(Sensor_t* self);

// State machine functions
void Sensor_dispatch_event(Sensor_t* self, Sensor_Event evt);
const char* Sensor_state_name(Sensor_State state);

#endif /* SENSOR_H */