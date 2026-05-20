import type { MessageDefinition } from "@foxglove/message-definition";

export const basicDatatypes: Map<string, MessageDefinition> = new Map([
  [
    "builtin_interfaces/msg/Time",
    {
      definitions: [
        { name: "sec", type: "int32" },
        { name: "nanosec", type: "uint32" },
      ],
    },
  ],
  [
    "builtin_interfaces/msg/Duration",
    {
      definitions: [
        { name: "sec", type: "int32" },
        { name: "nanosec", type: "uint32" },
      ],
    },
  ],
]);
