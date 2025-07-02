import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, Settings } from "lucide-react";

const Setup = () => {
  const [locations, setLocations] = useState([
    { id: 1, name: "Main Floor", capacity: 20 },
    { id: 2, name: "Studio 2", capacity: 15 },
    { id: 3, name: "Lifting Platform", capacity: 8 },
    { id: 4, name: "Outdoor Area", capacity: 25 },
  ]);

  const [skills, setSkills] = useState([
    "CrossFit Level 1",
    "Yoga Certified",
    "Kids Class Certified",
    "Olympic Lifting",
    "Nutrition Coaching",
  ]);

  const [newLocation, setNewLocation] = useState({ name: "", capacity: "" });
  const [newSkill, setNewSkill] = useState("");
  const [country, setCountry] = useState("United States");

  const addLocation = () => {
    if (newLocation.name && newLocation.capacity) {
      setLocations([
        ...locations,
        {
          id: Date.now(),
          name: newLocation.name,
          capacity: parseInt(newLocation.capacity),
        },
      ]);
      setNewLocation({ name: "", capacity: "" });
    }
  };

  const removeLocation = (id: number) => {
    setLocations(locations.filter((loc) => loc.id !== id));
  };

  const addSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gym Setup</h1>
              <p className="text-sm text-slate-600">
                Configure your gym's locations and settings
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* General Settings */}
          <Card className="bg-white/60 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic gym information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="United Kingdom">
                      United Kingdom
                    </SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Manage Skills */}
          <Card className="bg-white/60 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle>Coach Skills</CardTitle>
              <CardDescription>
                Define skills and certifications for your coaches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Add new skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addSkill()}
                />
                <Button onClick={addSkill} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{skill}</span>
                    <button onClick={() => removeSkill(skill)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manage Locations */}
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Locations</span>
            </CardTitle>
            <CardDescription>Manage your gym's class locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <Label htmlFor="locationName">Location Name</Label>
                <Input
                  id="locationName"
                  placeholder="e.g., Main Floor"
                  value={newLocation.name}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="Max participants"
                  value={newLocation.capacity}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, capacity: e.target.value })
                  }
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addLocation} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
              </div>
            </div>

            {/* Existing Locations */}
            <div className="grid gap-4">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-br from-teal-500 to-blue-600 p-2 rounded-lg">
                      <MapPin className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800">
                        {location.name}
                      </h3>
                      <p className="text-sm text-slate-600">
                        Capacity: {location.capacity} people
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeLocation(location.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Setup;
