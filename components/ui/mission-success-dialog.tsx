import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MissionSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;

  title: string;
  description: string;

  primaryButtonText: string;
  onPrimaryClick: (inputValue: string) => void;

  secondaryButtonText: string;
  onSecondaryClick: () => void;

  // optional UI
  imageUrl?: string;
  heroIcon?: React.ReactNode;

  showInput?: boolean;
  inputPlaceholder?: string;

  badgeText?: string;
  badgeIcon?: React.ReactNode;
}

export const MissionSuccessDialog: React.FC<MissionSuccessDialogProps> = ({
  isOpen,
  onClose,
  imageUrl,
  heroIcon,
  title,
  description,
  showInput = false,
  inputPlaceholder = "Enter a value",
  primaryButtonText,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
  badgeText,
  badgeIcon,
}) => {
  const [inputValue, setInputValue] = React.useState("");

  const handlePrimaryClick = () => {
    onPrimaryClick(inputValue);
    onClose();
  };

  const handleSecondaryClick = () => {
    onSecondaryClick();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl"
          >
            <div className="relative p-8 text-center">
              {badgeText && (
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {badgeIcon}
                  <span>{badgeText}</span>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-8 w-8 rounded-full"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="illustration"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    {heroIcon ?? <CheckCircle2 className="h-7 w-7 text-green-600" />}
                  </div>
                )}
              </div>

              <h2 className="mb-2 text-2xl font-bold text-card-foreground">{title}</h2>

              <p className="mb-6 text-sm text-muted-foreground">{description}</p>

              <div className="flex flex-col gap-4">
                {showInput && (
                  <Input
                    type="text"
                    placeholder={inputPlaceholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="bg-secondary text-center text-secondary-foreground placeholder:text-muted-foreground"
                  />
                )}

                <Button onClick={handlePrimaryClick} size="lg" className="w-full">
                  {primaryButtonText}
                </Button>

                <Button
                  variant="link"
                  onClick={handleSecondaryClick}
                  className="text-muted-foreground"
                >
                  {secondaryButtonText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
