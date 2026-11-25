#include "Sensor.h"
#include "Controller.h"
#include "runtime_c/uml_port.h"
#include <string.h>


/* ====================================================================== */
/*                        Sensor Implementation                         */
/* ====================================================================== */

// Static instance storage
static Sensor_t s_instance;
static bool s_instance_allocated = false;

const char* Sensor_state_name(Sensor_State state) {
    switch (state) {
        case SENSOR_STATE_IDLE: return "Idle";
        case SENSOR_STATE_SAMPLING: return "Sampling";
        case SENSOR_STATE_OVERHEATALERT: return "OverheatAlert";
        default: return "UNKNOWN";
    }
}

// Default Lifecycle Initializer
void Sensor_init(Sensor_t* self) {
    if (self == NULL) {
        return;
    }
    memset(self, 0, sizeof(*self));
    self->header.is_allocated = true;
    self->suhu = 0.0f;
    self->controller = NULL;
    self->current_state = SENSOR_STATE_IDLE;
}

// Constructor (Static Pool Singleton)
Sensor_t* Sensor_create(void) {
    if (s_instance_allocated) {
        return NULL;
    }
    Sensor_t* self = &s_instance;
    s_instance_allocated = true;
    Sensor_init(self);
    return self;
}

// Destructor
void Sensor_destroy(Sensor_t* self) {
    if (self == &s_instance) {
        s_instance_allocated = false;
    }
}

float Sensor_get_suhu(const Sensor_t* self) {
    return self->suhu;
}

void Sensor_set_suhu(Sensor_t* self, float value) {
    if (self != NULL) {
        self->suhu = value;
    }
}

void Sensor_relate_R1(Sensor_t* self, Controller_t* target) {
    if (self != NULL) {
        self->controller = target;
    }
}

void Sensor_unrelate_R1(Sensor_t* self) {
    if (self != NULL) {
        self->controller = NULL;
    }
}

Controller_t* Sensor_get_controller(const Sensor_t* self) {
    return (self != NULL) ? self->controller : NULL;
}

void Sensor_set_controller(Sensor_t* self, Controller_t* target) {
    if (self != NULL) {
        self->controller = target;
    }
}

void Sensor_bacaData(Sensor_t* self) {
    (void)self;
    self->suhu = 27.5f;
}

// State machine event dispatcher
void Sensor_dispatch_event(Sensor_t* self, Sensor_Event evt) {
    if (self == NULL) {
        return;
    }
    (void)evt;
    Sensor_State old_state = self->current_state;
    Sensor_State new_state = old_state;

    // State transition logic
    switch (old_state) {
        case SENSOR_STATE_IDLE: {
            switch (evt) {
                case SENSOR_EVENT_STARTSAMPLING: {
                    new_state = SENSOR_STATE_SAMPLING;
                    break;
                }
                default: break;
            }
            break;
        }
        case SENSOR_STATE_SAMPLING: {
            switch (evt) {
                case SENSOR_EVENT_SAMPLEOK: {
                    new_state = SENSOR_STATE_IDLE;
                    break;
                }
                case SENSOR_EVENT_OVERHEAT: {
                    new_state = SENSOR_STATE_OVERHEATALERT;
                    break;
                }
                default: break;
            }
            break;
        }
        case SENSOR_STATE_OVERHEATALERT: {
            switch (evt) {
                case SENSOR_EVENT_RESET: {
                    new_state = SENSOR_STATE_IDLE;
                    break;
                }
                default: break;
            }
            break;
        }
        default: break;
    }

    // Execute state transition
    if (new_state != old_state) {
        self->current_state = new_state;

        // Enter new state (xtUML Action Diagram OAL Entry)
        switch (new_state) {
            case SENSOR_STATE_IDLE: {
                self->suhu = 0.0f;
                break;
            }
            case SENSOR_STATE_SAMPLING: {
                Sensor_bacaData(self);
                Controller_t* ctrl = self->controller;
                if ((ctrl != NULL)) {
                    if (self->suhu > ctrl->batas_suhu) {
                        Sensor_dispatch_event(self, SENSOR_EVENT_OVERHEAT);
                    }
                }
                break;
            }
            case SENSOR_STATE_OVERHEATALERT: {
                Controller_t* ctrl = self->controller;
                if ((ctrl != NULL)) {
                    ctrl->alarm_aktif = true;
                }
                break;
            }
            default: break;
        }
    }
}
