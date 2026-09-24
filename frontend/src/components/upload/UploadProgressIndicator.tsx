import { CircleCheck } from "lucide-react";
import { Loader, RingProgress } from "@mantine/core";
const UploadProgressIndicator = ({ progress }: { progress: number }) => {
  if (progress > 0 && progress < 100) {
    return (
      <RingProgress
        sections={[{ value: progress, color: "victoria" }]}
        thickness={3}
        size={25}
      />
    );
  } else if (progress >= 100) {
    return <CircleCheck color="green" size={22} />;
  } else {
    return <Loader color="red" size={19} />;
  }
};

export default UploadProgressIndicator;
