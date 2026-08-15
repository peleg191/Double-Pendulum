function export_orbits_for_web()
%EXPORT_ORBITS_FOR_WEB Validate MAT trajectories and export the static web library.
% MATLAB trajectories remain authoritative; this script only normalizes them.

projectRoot = fileparts(fileparts(mfilename('fullpath')));
dataOut = fullfile(projectRoot, 'public', 'data');
matOut = fullfile(projectRoot, 'public', 'mat');
ensureDirectory(dataOut);
ensureDirectory(matOut);

families = [ ...
    struct('directory', 'trajectories', 'id', 'saddle_E2', ...
           'label', 'Saddle at E = 2', 'saddleEnergy', 2), ...
    struct('directory', 'trajectories_E4_saddle', 'id', 'saddle_E4', ...
           'label', 'Saddle at E = 4', 'saddleEnergy', 4) ...
];

manifestOrbits = struct([]);
manifestFamilies = struct([]);
for familyIndex = 1:numel(families)
    family = families(familyIndex);
    sourceDirectory = fullfile(projectRoot, family.directory);
    destinationDirectory = fullfile(matOut, family.id);
    ensureDirectory(destinationDirectory);
    files = dir(fullfile(sourceDirectory, 'traj_*.mat'));
    [~, order] = sort({files.name});
    files = files(order);

    for fileIndex = 1:numel(files)
        sourcePath = fullfile(sourceDirectory, files(fileIndex).name);
        raw = load(sourcePath);
        orbit = normalizeOrbit(raw, family, files(fileIndex).name);
        orbitId = makeOrbitId(family.id, orbit.metadata.energy);
        jsonName = ['orbit_' orbitId '.json'];
        writeJson(fullfile(dataOut, jsonName), orbit);
        copyfile(sourcePath, fullfile(destinationDirectory, files(fileIndex).name), 'f');
        record = struct('id', orbitId, 'energy', orbit.metadata.energy, ...
            'period', orbit.metadata.period, 'family_id', family.id, ...
            'trajectory', ['data/' jsonName], ...
            'mat', ['mat/' family.id '/' files(fileIndex).name]);
        manifestOrbits = appendStruct(manifestOrbits, record);
    end

    familyRecord = struct('id', family.id, 'label', family.label, ...
        'saddle_energy', family.saddleEnergy, 'orbit_count', numel(files));
    manifestFamilies = appendStruct(manifestFamilies, familyRecord);
end

if ~isempty(manifestOrbits)
    familyIds = string({manifestOrbits.family_id}).';
    energies = [manifestOrbits.energy].';
    [~, order] = sortrows(table(familyIds, energies), {'familyIds', 'energies'});
    manifestOrbits = manifestOrbits(order);
end

manifest = struct('schema_version', 1, ...
    'generated_at', char(datetime('now', 'TimeZone', 'UTC', ...
        'Format', 'yyyy-MM-dd''T''HH:mm:ssXXX')), ...
    'families', manifestFamilies, 'orbits', manifestOrbits);
writeJson(fullfile(dataOut, 'manifest.json'), manifest);
fprintf('Exported %d trajectories across %d families.\n', ...
    numel(manifestOrbits), numel(manifestFamilies));
end

function orbit = normalizeOrbit(raw, family, sourceFile)
required = {'E', 'T', 't', 'th1', 'th2'};
for index = 1:numel(required)
    assert(isfield(raw, required{index}), 'Missing %s in %s', required{index}, sourceFile);
end
t = column(raw.t); theta1 = column(raw.th1); theta2 = column(raw.th2);
sampleCount = numel(t);
assert(sampleCount >= 2, 'Empty trajectory in %s', sourceFile);
assert(numel(theta1) == sampleCount && numel(theta2) == sampleCount, ...
    'Unequal trajectory lengths in %s', sourceFile);
assert(all(isfinite([t; theta1; theta2])), 'NaN or Inf in %s', sourceFile);
assert(all(diff(t) > 0), 'Time is not strictly increasing in %s', sourceFile);

trajectory = struct('t', t, 'theta1', theta1, 'theta2', theta2);
optional = {'p1', 'p2', 'w1', 'w2'};
for index = 1:numel(optional)
    field = optional{index};
    if isfield(raw, field)
        values = column(raw.(field));
        assert(numel(values) == sampleCount && all(isfinite(values)), ...
            'Invalid %s in %s', field, sourceFile);
        outputName = field;
        if strcmp(field, 'w1'), outputName = 'omega1'; end
        if strcmp(field, 'w2'), outputName = 'omega2'; end
        trajectory.(outputName) = values;
    end
end

metadata = struct('energy', double(raw.E), 'period', double(raw.T), ...
    'family_id', family.id, 'saddle_energy', family.saddleEnergy, ...
    'sample_count', sampleCount, 'source_file', sourceFile);
parameters = struct();
if isfield(raw, 'g'), parameters.g = double(raw.g); end
validation = struct('time_start_residual', abs(t(1)), ...
    'period_endpoint_residual', abs(t(end) - double(raw.T)));
orbit = struct('schema_version', 1, 'metadata', metadata, ...
    'parameters', parameters, 'trajectory', trajectory, ...
    'validation', validation);
end

function values = column(values)
values = double(values(:));
end
function id = makeOrbitId(familyId, energy)
energyText = strrep(sprintf('%.6f', energy), '.', 'p');
energyText = regexprep(energyText, '0+$', '');
energyText = regexprep(energyText, 'p$', 'p0');
id = sprintf('%s_E_%s', familyId, energyText);
end
function writeJson(path, value)
text = jsonencode(value);
file = fopen(path, 'w', 'n', 'UTF-8');
assert(file ~= -1, 'Could not open %s', path);
cleanup = onCleanup(@() fclose(file)); %#ok<NASGU>
fwrite(file, text, 'char');
end
function ensureDirectory(path)
if ~isfolder(path), mkdir(path); end
end
function values = appendStruct(values, value)
if isempty(values), values = value; else, values(end + 1) = value; end
end
