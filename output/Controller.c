#include "Controller.h"
#include "runtime_c/uml_port.h"
#include <string.h>


/* ====================================================================== */
/*                      Controller Implementation                       */
/* ====================================================================== */

// Static instance storage
static Controller_t s_instance;
static bool s_instance_allocated = false;

// Default Lifecycle Initializer
void Controller_init(Controller_t* self) {
    if (self == NULL) {
        return;
    }
    memset(self, 0, sizeof(*self));
    self->header.is_allocated = true;
    self->batas_suhu = 30.0f;
    self->alarm_aktif = false;
}

// Constructor (Static Pool Singleton)
Controller_t* Controller_create(void) {
    if (s_instance_allocated) {
        return NULL;
    }
    Controller_t* self = &s_instance;
    s_instance_allocated = true;
    Controller_init(self);
    return self;
}

// Destructor
void Controller_destroy(Controller_t* self) {
    if (self == &s_instance) {
        s_instance_allocated = false;
    }
}

float Controller_get_batas_suhu(const Controller_t* self) {
    return self->batas_suhu;
}

void Controller_set_batas_suhu(Controller_t* self, float value) {
    if (self != NULL) {
        self->batas_suhu = value;
    }
}

bool Controller_get_alarm_aktif(const Controller_t* self) {
    return self->alarm_aktif;
}

void Controller_set_alarm_aktif(Controller_t* self, bool value) {
    if (self != NULL) {
        self->alarm_aktif = value;
    }
}

bool Controller_cekAmbangBatas(Controller_t* self, float suhu_ukur) {
    (void)self;
    (void)suhu_ukur;
    self->alarm_aktif = (suhu_ukur > self->batas_suhu);
    return self->alarm_aktif;
}
