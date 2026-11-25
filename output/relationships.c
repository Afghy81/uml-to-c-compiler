#include "relationships.h"
#include <stddef.h>

// Relationship R1: Sensor -> Controller
void Sensor_relate_Controller(Sensor_t* src, Controller_t* tgt) {
    if (src != NULL) {
        src->controller = tgt;
    }
}

void Sensor_unrelate_Controller(Sensor_t* src, Controller_t* tgt) {
    (void)tgt;
    if (src != NULL) {
        src->controller = NULL;
    }
}
